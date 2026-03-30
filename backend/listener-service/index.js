require("dotenv").config();
const { connectRabbitMQ } = require("./config/rabbitmq");
const { createContractInstance, CONTRACT_ABI } = require("./config/contract");
const {
    publishCampaignCreated,
} = require("./publishers/campaignCreated.publisher");
const {
    publishCertificateMinted,
} = require("./publishers/certificateMinted.publisher");
const { publishRefundIssued } = require("./publishers/refundIssued.publisher");
const {
    publishFundingComplete,
} = require("./publishers/fundingComplete.publisher");
const {
    publishMilestoneRefunded,
} = require("./publishers/milestoneRefunded.publisher");
const {
    publishMilestoneFailed,
} = require("./publishers/milestoneFailed.publisher");
const { startMarkFailedDailyJob } = require("./jobs/markFailed.job");

async function startListener() {
    await connectRabbitMQ();
    startMarkFailedDailyJob();

    const result = createContractInstance();

    if (!result) {
        console.warn(
            "[listener-service] Contract chưa cấu hình – service chạy ở chế độ chờ.\n" +
                "  Điền SEPOLIA_RPC_URL và CROWDFUNDING_CONTRACT_ADDRESS vào .env để kích hoạt listener.",
        );
        return;
    }

    const { contract } = result;
    console.log(
        "[listener-service] Contract listener đã sẵn sàng. Đang lắng nghe events...",
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
                `[listener-service] Skip event '${eventName}' (không có trong ABI hiện tại).`,
            );
            return;
        }
        contract.on(eventName, handler);
        console.log(`[listener-service] Listening event '${eventName}'`);
    };

    const mapMilestoneForPayload = (milestone, fallbackIndex) => ({
        milestoneIndex: Number(milestone.id ?? fallbackIndex),
        title: milestone.title || `Milestone ${fallbackIndex}`,
        description: milestone.description || "",
        financialTargetWei: (milestone.fundAmount ?? 0n).toString(),
        deadline: Number(milestone.deadline ?? 0),
        statusCode: Number(milestone.status ?? 0),
        proofIpfsCid: milestone.proofIpfsCid || "",
    });

    // ── Event: CampaignCreated ────────────────────────────────
    onIfSupported(
        "CampaignCreated",
        async (
            id,
            creator,
            beneficiary,
            goal,
            deadline,
            milestoneCount,
            event,
        ) => {
            console.log(
                `[listener-service] Event CampaignCreated: campaignId=${id}`,
            );

            let milestones = [];
            try {
                if (typeof contract.getAllMilestones === "function") {
                    const onChainMilestones =
                        await contract.getAllMilestones(id);
                    milestones = onChainMilestones.map((m, idx) =>
                        mapMilestoneForPayload(m, idx + 1),
                    );
                }
            } catch (err) {
                console.error(
                    `[listener-service] Không thể đọc milestones cho campaignId=${id}: ${err.message}`,
                );
            }

            await publishCampaignCreated({
                campaignId: id,
                creator,
                beneficiary,
                goal,
                deadline,
                milestoneCount: Number(milestoneCount),
                milestones,
                txHash: event.log.transactionHash,
            });
        },
    );

    // ABI mới không có CertificateMinted custom event, fallback bằng ERC721 Transfer(from=0x0)
    onIfSupported("Transfer", async (from, to, tokenId, event) => {
        if ((from || "").toLowerCase() !== ZERO_ADDRESS) return;

        try {
            let campaignId = 0;
            if (typeof contract.tokenToCampaign === "function") {
                campaignId = Number(await contract.tokenToCampaign(tokenId));
            }

            await publishCertificateMinted({
                tokenId,
                campaignId,
                owner: to,
                txHash: event.log.transactionHash,
            });
        } catch (err) {
            console.error(
                `[listener-service] Transfer→CertificateMinted mapping failed: ${err.message}`,
            );
        }
    });

    // ── Event: FundingComplete ─────────────────────────────────
    onIfSupported(
        "FundingComplete",
        async (campaignId, totalRaisedWei, event) => {
            console.log(
                `[listener-service] Event FundingComplete: campaignId=${campaignId}, ` +
                    `totalRaisedWei=${totalRaisedWei}`,
            );
            await publishFundingComplete({
                campaignId,
                totalRaisedWei,
                txHash: event.log.transactionHash,
                logIndex: event.log.logIndex,
            });
        },
    );

    // ── Event: MilestoneRefunded ──────────────────────────────
    onIfSupported(
        "MilestoneRefunded",
        async (campaignId, milestoneId, donor, refundedWei, event) => {
            console.log(
                `[listener-service] Event MilestoneRefunded: campaignId=${campaignId}, ` +
                    `donor=${donor}, refundedWei=${refundedWei}`,
            );
            await publishMilestoneRefunded({
                campaignId,
                milestoneId,
                donorAddress: donor,
                refundedWei,
                txHash: event.log.transactionHash,
                logIndex: event.log.logIndex,
            });

            // milestoneId = 0 => funding-phase full refund (compatibility with old refund flow)
            if (Number(milestoneId) === 0) {
                await publishRefundIssued({
                    campaignId,
                    donor,
                    amount: refundedWei,
                    txHash: event.log.transactionHash,
                });
            }
        },
    );

    // ── Event: MilestoneFailed ────────────────────────────────
    // Trigger: MilestoneRefunded event when a milestone is marked as failed by reviewer
    // Effect: Cascade failure to campaign level → all donors eligible for refund
    onIfSupported(
        "MilestoneFailed",
        async (campaignId, milestoneId, markedBy, amount, event) => {
            console.log(
                `[listener-service] Event MilestoneFailed: campaignId=${campaignId}, ` +
                    `milestoneId=${milestoneId}, amount=${amount}`,
            );
            await publishMilestoneFailed({
                campaignId,
                milestoneId,
                markedBy,
                amount,
                txHash: event.log.transactionHash,
                logIndex: event.log.logIndex,
                blockNumber: event.log.blockNumber,
            });
        },
    );

    // Xử lý lỗi provider
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
