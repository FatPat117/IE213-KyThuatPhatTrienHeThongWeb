const { getChannel, EXCHANGE } = require("../config/rabbitmq");
const certificateService = require("../services/certificate.service");

const QUEUE = "cert.minted.queue";
const ROUTING_KEY = "certificate.minted";

// TODO: Implement sau khi NFT contract (ERC-721) được viết và deploy
async function startCertificateMintedConsumer() {
    const channel = getChannel();
    if (!channel) {
        console.warn("[certificate-service] RabbitMQ channel không có – bỏ qua consumer");
        return;
    }

    await channel.assertQueue(QUEUE, { durable: true });
    await channel.bindQueue(QUEUE, EXCHANGE, ROUTING_KEY);
    channel.prefetch(1);

    console.log(`[certificate-service] Consumer đang lắng nghe queue: ${QUEUE}`);

    channel.consume(QUEUE, async (msg) => {
        if (!msg) return;
        try {
            const payload = JSON.parse(msg.content.toString());
            console.log("[certificate-service] Nhận event certificate.minted:", payload);

            /**
             * TODO: Payload từ listener-service sau khi NFT contract sẵn sàng:
             * { tokenId, campaignOnChainId, ownerWallet, metadataUri }
             */
            await certificateService.createCertificate({
                tokenId: payload.tokenId,
                campaignOnChainId: payload.campaignOnChainId,
                ownerWallet: payload.ownerWallet,
                metadataUri: payload.metadataUri,
                mintedAt: new Date(),
            });

            console.log(`[certificate-service] Đã lưu certificate tokenId=${payload.tokenId}`);
            channel.ack(msg);
        } catch (err) {
            console.error("[certificate-service] Consumer error:", err.message);
            channel.nack(msg, false, false);
        }
    });
}

module.exports = { startCertificateMintedConsumer };
