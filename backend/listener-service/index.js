require("dotenv").config();
const { connectRabbitMQ, publishWithRetry } = require("./config/rabbitmq");
const { createContractInstance, CONTRACT_ABI } = require("./config/contract");
const { startMarkFailedDailyJob } = require("./jobs/markFailed.job");
const axios = require("axios");

function normalizeMeta(event) {
    return {
        txHash: event?.log?.transactionHash || event?.transactionHash || "",
        blockNumber: String(
            event?.log?.blockNumber ?? event?.blockNumber ?? "0",
        ),
        logIndex: Number(event?.log?.logIndex ?? event?.logIndex ?? -1),
    };
}

async function publish(routingKey, payload) {
    const published = await publishWithRetry(routingKey, payload);
    if (!published) {
        console.error(
            `[listener-service] Failed to publish ${routingKey} after retries`,
        );
        return false;
    }
    console.log(`[listener-service] Published ${routingKey}`);
    return true;
}

async function upsertTransactionFromEvent(payload, retries = 3) {
    const baseUrl = process.env.TRANSACTION_SERVICE_URL;
    if (!baseUrl || !payload?.txHash || !payload?.walletAddress) {
        return;
    }

    let lastError = null;
    for (let attempt = 1; attempt <= retries; attempt += 1) {
        try {
            await axios.post(
                `${baseUrl}/api/transactions/internal/upsert`,
                payload,
                { timeout: 10_000 },
            );
            return;
        } catch (error) {
            lastError = error;
            await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
        }
    }

    console.error(
        `[listener-service] Could not upsert transaction after ${retries} retries: ${
            lastError?.message || "unknown error"
        }`,
    );
}

function parseReplayStartBlock(rawValue) {
    const value = (rawValue || "").toString().trim();
    if (!value) return null;

    if (value.startsWith("0x")) {
        const parsed = Number.parseInt(value, 16);
        return Number.isFinite(parsed) ? parsed : null;
    }

    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
}

async function replayCampaignCreatedEvents(contract) {
    const fromBlock = parseReplayStartBlock(
        process.env.LISTENER_REPLAY_FROM_BLOCK,
    );
    if (fromBlock === null) {
        return;
    }

    const latestBlock = await contract.runner.provider.getBlockNumber();
    if (fromBlock > latestBlock) {
        console.warn(
            `[listener-service] LISTENER_REPLAY_FROM_BLOCK=${fromBlock} is above latest block=${latestBlock}. Skip replay.`,
        );
        return;
    }

    console.log(
        `[listener-service] Replaying CampaignCreated from block ${fromBlock} to ${latestBlock}...`,
    );

    const maxBlocksPerQuery = Math.max(
        Number(process.env.RPC_LOGS_MAX_BLOCK_RANGE || 10),
        1,
    );
    const maxBlockSpan = Math.max(maxBlocksPerQuery - 1, 0);
    const logs = [];

    for (
        let rangeStart = fromBlock;
        rangeStart <= latestBlock;
        rangeStart += maxBlockSpan + 1
    ) {
        const rangeEnd = Math.min(rangeStart + maxBlockSpan, latestBlock);
        const partial = await contract.queryFilter(
            contract.filters.CampaignCreated(),
            rangeStart,
            rangeEnd,
        );
        logs.push(...partial);
    }

    for (const log of logs) {
        const args = Array.isArray(log?.args) ? log.args : [];
        const campaignId = args[0];
        const creator = args[1];
        const beneficiary = args[2];
        const goal = args[3];
        const fundingDeadline = args[4];
        const milestoneCount = args[5];

        if (
            campaignId === undefined ||
            !creator ||
            !beneficiary ||
            goal === undefined ||
            fundingDeadline === undefined ||
            milestoneCount === undefined
        ) {
            continue;
        }

        await publish("campaign.created", {
            onChainId: campaignId.toString(),
            creator,
            beneficiary,
            goalWei: goal.toString(),
            deadline: fundingDeadline.toString(),
            milestoneCount: milestoneCount.toString(),
            txHash: log.transactionHash || "",
            blockNumber: String(log.blockNumber || "0"),
        });
    }

    console.log(
        `[listener-service] Replayed CampaignCreated events: ${logs.length}`,
    );
}

async function reconcileCampaignsFromChain(contract) {
    const shouldReconcile =
        (process.env.LISTENER_RECONCILE_CAMPAIGNS_ON_START || "false")
            .trim()
            .toLowerCase() === "true";
    if (!shouldReconcile) {
        return;
    }

    const campaignCount = Number(await contract.campaignCount());
    if (!Number.isFinite(campaignCount) || campaignCount <= 0) {
        return;
    }

    console.log(
        `[listener-service] Reconciling campaigns from chain: 1..${campaignCount}`,
    );

    let publishedCount = 0;
    for (let campaignId = 1; campaignId <= campaignCount; campaignId += 1) {
        try {
            const campaign = await contract.getCampaign(BigInt(campaignId));
            const creator = (campaign?.creator || campaign?.[1] || "").toString();
            const beneficiary = (campaign?.beneficiary || campaign?.[2] || "").toString();

            if (!creator || !beneficiary) {
                continue;
            }

            const goal =
                campaign?.goal !== undefined ? campaign.goal : campaign?.[3] || 0n;
            const deadline =
                campaign?.deadline !== undefined ? campaign.deadline : campaign?.[6] || 0n;
            const milestoneCount =
                campaign?.milestoneCount !== undefined
                    ? campaign.milestoneCount
                    : campaign?.[9] || 0n;

            await publish("campaign.created", {
                onChainId: campaignId.toString(),
                creator,
                beneficiary,
                goalWei: goal.toString(),
                deadline: deadline.toString(),
                milestoneCount: milestoneCount.toString(),
                txHash: "",
                blockNumber: "0",
            });
            publishedCount += 1;
        } catch (error) {
            console.warn(
                `[listener-service] Reconcile skipped campaignId=${campaignId}: ${error?.message || error}`,
            );
        }
    }

    console.log(
        `[listener-service] Reconcile completed. published campaign.created events: ${publishedCount}`,
    );
}

async function startListener() {
    await connectRabbitMQ();
    startMarkFailedDailyJob();

    const result = createContractInstance();

    if (!result) {
        console.warn(
            "[listener-service] Contract is not configured. Service is running in idle mode.",
        );
        return;
    }

    const { contract } = result;
    console.log(
        "[listener-service] Contract listener is ready. Waiting for events...",
    );

    const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
    const FUNDING_FAILURE_MILESTONE_SENTINEL = 2n ** 256n - 1n;
    const abiEventNames = new Set(
        (Array.isArray(CONTRACT_ABI) ? CONTRACT_ABI : [])
            .filter((item) => item && item.type === "event" && item.name)
            .map((item) => item.name),
    );

    const onIfSupported = (eventName, handler) => {
        if (!abiEventNames.has(eventName)) {
            console.log(
                `[listener-service] Skip event '${eventName}' (missing in current ABI).`,
            );
            return;
        }
        contract.on(eventName, handler);
        console.log(`[listener-service] Listening event '${eventName}'`);
    };

    onIfSupported(
        "CampaignCreated",
        async (
            campaignId,
            creator,
            beneficiary,
            goal,
            fundingDeadline,
            milestoneCount,
            event,
        ) => {
            const meta = normalizeMeta(event);
            await publish("campaign.created", {
                onChainId: campaignId.toString(),
                creator,
                beneficiary,
                goalWei: goal.toString(),
                deadline: fundingDeadline.toString(),
                milestoneCount: milestoneCount.toString(),
                txHash: meta.txHash,
                blockNumber: meta.blockNumber,
            });

            // Avoid race where frontend tx pending arrives slightly later.
            // Upsert guarantees create-or-update to status=success by txHash.
            await upsertTransactionFromEvent({
                txHash: meta.txHash,
                walletAddress: (creator || "").toLowerCase(),
                action: "createCampaign",
                campaignOnChainId: Number(campaignId),
            });
        },
    );

    onIfSupported(
        "Donated",
        async (campaignId, donor, amount, totalRaised, event) => {
            const meta = normalizeMeta(event);
            const amountWei = amount.toString();
            await publish("donation.received", {
                campaignOnChainId: campaignId.toString(),
                campaignId: campaignId.toString(),
                donorWallet: donor.toLowerCase(),
                amount: amountWei,
                amountEth: Number(amountWei) / 1e18,
                totalRaisedWei: totalRaised.toString(),
                txHash: meta.txHash,
                blockNumber: meta.blockNumber,
                logIndex: meta.logIndex,
            });
        },
    );

    onIfSupported(
        "FundingComplete",
        async (campaignId, totalRaisedWei, event) => {
            const meta = normalizeMeta(event);
            await publish("campaign.funding.completed", {
                campaignId: campaignId.toString(),
                totalRaisedWei: totalRaisedWei.toString(),
                txHash: meta.txHash,
                blockNumber: meta.blockNumber,
                logIndex: meta.logIndex,
            });
        },
    );

    onIfSupported(
        "MilestoneReportSubmitted",
        async (campaignId, milestoneId, cid, submittedBy, event) => {
            const meta = normalizeMeta(event);
            await publish("milestone.report.submitted", {
                campaignId: campaignId.toString(),
                milestoneId: milestoneId.toString(),
                cid,
                submittedBy: submittedBy.toLowerCase(),
                txHash: meta.txHash,
                blockNumber: meta.blockNumber,
                logIndex: meta.logIndex,
            });
        },
    );

    onIfSupported(
        "MilestoneApproved",
        async (campaignId, milestoneId, reviewer, ipfsCid, amount, event) => {
            const meta = normalizeMeta(event);
            await publish("milestone.approved", {
                campaignId: campaignId.toString(),
                milestoneId: milestoneId.toString(),
                reviewer: reviewer.toLowerCase(),
                ipfsCid,
                amountWei: amount.toString(),
                txHash: meta.txHash,
                blockNumber: meta.blockNumber,
                logIndex: meta.logIndex,
            });
        },
    );

    onIfSupported(
        "MilestoneDisbursed",
        async (campaignId, milestoneId, beneficiary, amount, event) => {
            const meta = normalizeMeta(event);
            await publish("milestone.disbursed", {
                campaignId: campaignId.toString(),
                milestoneId: milestoneId.toString(),
                beneficiary: beneficiary.toLowerCase(),
                amountWei: amount.toString(),
                txHash: meta.txHash,
                blockNumber: meta.blockNumber,
                logIndex: meta.logIndex,
            });
        },
    );

    onIfSupported(
        "MilestoneFailed",
        async (campaignId, milestoneId, markedBy, amount, event) => {
            const meta = normalizeMeta(event);
            await publish("milestone.failed", {
                campaignId: campaignId.toString(),
                milestoneId: milestoneId.toString(),
                markedBy: markedBy.toLowerCase(),
                amountWei: amount.toString(),
                txHash: meta.txHash,
                blockNumber: meta.blockNumber,
                logIndex: meta.logIndex,
            });
        },
    );

    onIfSupported(
        "CampaignStopped",
        async (campaignId, remainingWei, milestoneId, event) => {
            const meta = normalizeMeta(event);
            const campaignIdText = campaignId.toString();
            const milestoneIdText = milestoneId.toString();
            const remainingWeiText = remainingWei.toString();

            let parsedMilestoneId = null;
            try {
                parsedMilestoneId = BigInt(milestoneIdText);
            } catch {
                parsedMilestoneId = null;
            }

            const payload = {
                campaignId: campaignIdText,
                campaignOnChainId: campaignIdText,
                remainingWei: remainingWeiText,
                milestoneId: milestoneIdText,
                txHash: meta.txHash,
                blockNumber: meta.blockNumber,
                logIndex: meta.logIndex,
            };

            if (parsedMilestoneId === FUNDING_FAILURE_MILESTONE_SENTINEL) {
                await publish("campaign.failed", {
                    ...payload,
                    reason: "funding_deadline_not_reached_goal",
                });
                return;
            }

            await publish("campaign.stopped", payload);
        },
    );

    onIfSupported(
        "MilestoneRefunded",
        async (campaignId, milestoneId, donor, amount, event) => {
            const meta = normalizeMeta(event);
            const milestoneIdText = milestoneId.toString();

            let parsedMilestoneId = null;
            try {
                parsedMilestoneId = BigInt(milestoneIdText);
            } catch {
                parsedMilestoneId = null;
            }

            const isFundingRefund =
                parsedMilestoneId === FUNDING_FAILURE_MILESTONE_SENTINEL;

            await publish("milestone.refunded", {
                campaignId: campaignId.toString(),
                campaignOnChainId: campaignId.toString(),
                milestoneId: isFundingRefund ? null : milestoneIdText,
                refundType: isFundingRefund ? "funding" : "milestone",
                donor: donor.toLowerCase(),
                amountWei: amount.toString(),
                txHash: meta.txHash,
                blockNumber: meta.blockNumber,
                logIndex: meta.logIndex,
            });
        },
    );

    onIfSupported(
        "CertificateMinted",
        async (campaignId, owner, tokenId, event) => {
            const meta = normalizeMeta(event);
            await publish("certificate.minted", {
                campaignOnChainId: campaignId.toString(),
                ownerWallet: owner.toLowerCase(),
                tokenId: tokenId.toString(),
                txHash: meta.txHash,
                blockNumber: meta.blockNumber,
                logIndex: meta.logIndex,
            });
        },
    );

    if (
        !abiEventNames.has("CertificateMinted") &&
        abiEventNames.has("Transfer")
    ) {
        onIfSupported("Transfer", async (from, to, tokenId, event) => {
            if ((from || "").toLowerCase() !== ZERO_ADDRESS) {
                return;
            }
            const meta = normalizeMeta(event);
            let campaignId = "0";

            try {
                if (typeof contract.tokenToCampaign === "function") {
                    campaignId = (
                        await contract.tokenToCampaign(tokenId)
                    ).toString();
                }
            } catch (error) {
                console.warn(
                    `[listener-service] Could not map tokenId=${tokenId} to campaignId: ${error.message}`,
                );
            }

            await publish("certificate.minted", {
                campaignOnChainId: campaignId,
                ownerWallet: to.toLowerCase(),
                tokenId: tokenId.toString(),
                txHash: meta.txHash,
                blockNumber: meta.blockNumber,
                logIndex: meta.logIndex,
            });
        });
    }

    // Run replay in background so live listeners are not blocked at startup.
    void replayCampaignCreatedEvents(contract).catch((error) => {
        console.error(
            "[listener-service] Replay CampaignCreated failed:",
            error?.message || error,
        );
    });
    void reconcileCampaignsFromChain(contract).catch((error) => {
        console.error(
            "[listener-service] Reconcile campaigns failed:",
            error?.message || error,
        );
    });

    contract.runner.provider.on("error", (err) => {
        console.error("[listener-service] Provider error:", err.message);
    });
}

startListener().catch((err) => {
    console.error("[listener-service] Startup failed:", err.message);
    process.exit(1);
});

process.on("unhandledRejection", (err) => {
    console.error("[listener-service] Unhandled rejection:", err);
});
