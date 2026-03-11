require("dotenv").config();
const { connectRabbitMQ } = require("./config/rabbitmq");
const { createContractInstance } = require("./config/contract");
const { publishCampaignCreated } = require("./publishers/campaignCreated.publisher");
const { publishDonated } = require("./publishers/donated.publisher");
const { publishCertificateMinted } = require("./publishers/certificateMinted.publisher");
const { publishFundsWithdrawn } = require("./publishers/fundsWithdrawn.publisher");
const { publishCampaignCancelled } = require("./publishers/campaignCancelled.publisher");
const { startMarkFailedDailyJob } = require("./jobs/markFailed.job");

async function startListener() {
    await connectRabbitMQ();
    startMarkFailedDailyJob();

    const result = createContractInstance();

    if (!result) {
        console.warn(
            "[listener-service] Contract chưa cấu hình – service chạy ở chế độ chờ.\n" +
            "  Điền SEPOLIA_RPC_URL và CROWDFUNDING_CONTRACT_ADDRESS vào .env để kích hoạt listener."
        );
        return;
    }

    const { contract } = result;
    console.log("[listener-service] Contract listener đã sẵn sàng. Đang lắng nghe events...");

    // ── Event: CampaignCreated ────────────────────────────────
    contract.on("CampaignCreated", async (id, creator, beneficiary, goal, deadline, event) => {
        console.log(`[listener-service] Event CampaignCreated: campaignId=${id}`);
        await publishCampaignCreated({
            campaignId: id,
            creator,
            beneficiary,
            goal,
            deadline,
            txHash: event.log.transactionHash,
        });
    });

    // ── Event: Donated ────────────────────────────────────────
    contract.on("Donated", async (campaignId, donor, amount, event) => {
        console.log(`[listener-service] Event Donated: txHash=${event.log.transactionHash}`);
        await publishDonated({
            campaignId,
            donor,
            amount,
            txHash: event.log.transactionHash,
        });
    });

    // ── Event: CertificateMinted ──────────────────────────────
    contract.on("CertificateMinted", async (campaignId, owner, tokenId, event) => {
        console.log(`[listener-service] Event CertificateMinted: tokenId=${tokenId}`);
        await publishCertificateMinted({
            tokenId,
            campaignId,
            owner,
            txHash: event.log.transactionHash,
        });
    });

    // ── Event: FundsWithdrawn ─────────────────────────────────
    contract.on("FundsWithdrawn", async (campaignId, beneficiary, amount, event) => {
        console.log(`[listener-service] Event FundsWithdrawn: campaignId=${campaignId}`);
        await publishFundsWithdrawn({
            campaignId,
            beneficiary,
            amount,
            txHash: event.log.transactionHash,
        });
    });

    // ── Event: CampaignCancelled ──────────────────────────────
    contract.on("CampaignCancelled", async (campaignId, cancelledBy, event) => {
        console.log(`[listener-service] Event CampaignCancelled: campaignId=${campaignId}`);
        await publishCampaignCancelled({
            campaignId,
            cancelledBy,
            txHash: event.log.transactionHash,
        });
    });

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
