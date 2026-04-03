require("dotenv").config();
const { connectRabbitMQ, getChannel, EXCHANGE } = require("./config/rabbitmq");
const { createContractInstance, CONTRACT_ABI } = require("./config/contract");
const { startMarkFailedDailyJob } = require("./jobs/markFailed.job");

function normalizeMeta(event) {
    return {
        txHash: event?.log?.transactionHash || event?.transactionHash || "",
        blockNumber: String(event?.log?.blockNumber ?? event?.blockNumber ?? "0"),
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
            publish("campaign.stopped", {
                campaignId: campaignId.toString(),
                remainingWei: remainingWei.toString(),
                milestoneId: milestoneId.toString(),
                txHash: meta.txHash,
                blockNumber: meta.blockNumber,
                logIndex: meta.logIndex,
            });
        },
    );

    onIfSupported(
        "MilestoneRefunded",
        async (campaignId, milestoneId, donor, amount, event) => {
            const meta = normalizeMeta(event);
            publish("milestone.refunded", {
                campaignId: campaignId.toString(),
                milestoneId: milestoneId.toString(),
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
                campaignId: campaignId.toString(),
                ownerWallet: owner.toLowerCase(),
                tokenId: tokenId.toString(),
                txHash: meta.txHash,
                blockNumber: meta.blockNumber,
                logIndex: meta.logIndex,
            });
        },
    );

    if (!abiEventNames.has("CertificateMinted") && abiEventNames.has("Transfer")) {
        onIfSupported("Transfer", async (from, to, tokenId, event) => {
            if ((from || "").toLowerCase() !== ZERO_ADDRESS) {
                return;
            }
            const meta = normalizeMeta(event);
            let campaignId = "0";

            try {
                if (typeof contract.tokenToCampaign === "function") {
                    campaignId = (await contract.tokenToCampaign(tokenId)).toString();
                }
            } catch (error) {
                console.warn(
                    `[listener-service] Could not map tokenId=${tokenId} to campaignId: ${error.message}`,
                );
            }

            publish("certificate.minted", {
                campaignId,
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
