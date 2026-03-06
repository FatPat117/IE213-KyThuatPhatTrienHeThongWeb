require("dotenv").config();
const { connectRabbitMQ } = require("./config/rabbitmq");
const { createContractInstance } = require("./config/contract");
const { publishCampaignCreated } = require("./publishers/campaignCreated.publisher");
const { publishDonated } = require("./publishers/donated.publisher");
const { publishCertificateMinted } = require("./publishers/certificateMinted.publisher");

async function startListener() {
    // Kết nối RabbitMQ trước
    await connectRabbitMQ();

    // Khởi tạo contract instance
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

    /**
     * TODO: Uncomment các listener bên dưới sau khi Smart Contract được viết lại
     * với các events: CampaignCreated, Donated, CertificateMinted
     */

    // contract.on("CampaignCreated", async (campaignId, creator, title, goal, deadline, event) => {
    //   console.log(`[listener-service] Event CampaignCreated: campaignId=${campaignId}`);
    //   await publishCampaignCreated({
    //     campaignId,
    //     creator,
    //     title,
    //     goal,
    //     deadline,
    //     txHash: event.log.transactionHash,
    //   });
    // });

    // contract.on("Donated", async (campaignId, donor, amount, event) => {
    //   console.log(`[listener-service] Event Donated: txHash=${event.log.transactionHash}`);
    //   await publishDonated({
    //     campaignId,
    //     donor,
    //     amount,
    //     txHash: event.log.transactionHash,
    //   });
    // });

    // contract.on("CertificateMinted", async (tokenId, campaignId, owner, metadataUri, event) => {
    //   console.log(`[listener-service] Event CertificateMinted: tokenId=${tokenId}`);
    //   await publishCertificateMinted({ tokenId, campaignId, owner, metadataUri });
    // });

    // Xử lý lỗi provider
    contract.runner.provider.on("error", (err) => {
        console.error("[listener-service] Provider error:", err.message);
    });
}

startListener().catch((err) => {
    console.error("[listener-service] Startup failed:", err.message);
    process.exit(1);
});

// Giữ process chạy (không có HTTP server)
process.on("unhandledRejection", (err) => {
    console.error("[listener-service] Unhandled rejection:", err);
});
