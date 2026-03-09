const { getChannel, EXCHANGE } = require("../config/rabbitmq");
const donationService = require("../services/donation.service");

const QUEUE = process.env.RABBITMQ_QUEUE_DONATED_SVC || "donation.received.queue";
const ROUTING_KEY = process.env.RABBITMQ_RKEY_DONATED || "donation.received";

async function startDonatedConsumer() {
    const channel = getChannel();
    if (!channel) {
        console.warn("[donation-service] RabbitMQ channel không có – bỏ qua consumer");
        return;
    }

    await channel.assertQueue(QUEUE, { durable: true });
    await channel.bindQueue(QUEUE, EXCHANGE, ROUTING_KEY);
    channel.prefetch(1);

    console.log(`[donation-service] Consumer đang lắng nghe queue: ${QUEUE}`);

    channel.consume(QUEUE, async (msg) => {
        if (!msg) return;
        try {
            const payload = JSON.parse(msg.content.toString());
            console.log("[donation-service] Nhận event donation.received:", payload);

            /**
             * Payload từ listener-service:
             * { txHash, campaignOnChainId, donorWallet, amount (wei string), amountEth, message? }
             */
            await donationService.createDonation({
                txHash: payload.txHash,
                campaignOnChainId: payload.campaignOnChainId,
                donorWallet: payload.donorWallet,
                amount: payload.amount,
                amountEth: payload.amountEth,
                message: payload.message || "",
                donatedAt: new Date(),
            });

            console.log(`[donation-service] Đã lưu donation txHash=${payload.txHash}`);
            channel.ack(msg);
        } catch (err) {
            console.error("[donation-service] Consumer error:", err.message);
            channel.nack(msg, false, false);
        }
    });
}

module.exports = { startDonatedConsumer };
