require("dotenv").config();
const { connectRabbitMQ, getChannel, EXCHANGE } = require("./config/rabbitmq");
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

function publish(routingKey, payload) {
    const channel = getChannel();
    if (!channel) {
        console.warn(
            `[listener-service] RabbitMQ channel unavailable. Skip publish: ${routingKey}`,
        );
        return;
    }

    channel.publish(
        EXCHANGE,
        routingKey,
        Buffer.from(JSON.stringify(payload)),
        { persistent: true },
    );
    console.log(`[listener-service] Published ${routingKey}`);
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
            publish("campaign.created", {
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
            publish("donation.received", {
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
            publish("campaign.funding.completed", {
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
            publish("milestone.report.submitted", {
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
            publish("milestone.approved", {
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
            publish("milestone.disbursed", {
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
            publish("milestone.failed", {
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
                publish("campaign.failed", {
                    ...payload,
                    reason: "funding_deadline_not_reached_goal",
                });
                return;
            }

            publish("campaign.stopped", payload);
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

            publish("milestone.refunded", {
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
            publish("certificate.minted", {
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

            publish("certificate.minted", {
                campaignOnChainId: campaignId,
                ownerWallet: to.toLowerCase(),
                tokenId: tokenId.toString(),
                txHash: meta.txHash,
                blockNumber: meta.blockNumber,
                logIndex: meta.logIndex,
            });
        });
    }

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
