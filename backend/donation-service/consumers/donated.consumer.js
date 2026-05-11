const { getChannel, EXCHANGE } = require("../config/rabbitmq");
const donationService = require("../services/donation.service");
const { delCache, clearPrefix } = require("../utils/cache");

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
            const content = msg.content.toString();
            const payload = JSON.parse(content);
            console.log(`[donation-service] Received donation event: txHash=${payload.txHash}, campaign=${payload.campaignOnChainId}`);

            await donationService.createDonation({
                txHash: payload.txHash,
                campaignOnChainId: Number(payload.campaignOnChainId),
                donorWallet: (payload.donorWallet || "").toLowerCase(),
                amount: payload.amount?.toString() || "0",
                amountEth: Number(payload.amountEth || 0),
                message: payload.message || "",
                donatedAt: payload.donatedAt ? new Date(payload.donatedAt) : new Date(),
            });

            // Invalidate cache
            await delCache(`donation:campaign:${payload.campaignOnChainId}`);
            if (payload.donorWallet) {
                await delCache(`donation:donor:${payload.donorWallet.toLowerCase()}`);
            }
            await clearPrefix("donation:leaderboard:*");

            console.log(`[donation-service] Successfully recorded donation: txHash=${payload.txHash}`);
            channel.ack(msg);
        } catch (err) {
            console.error("[donation-service] Error processing donation event:", err.message);
            // Nack with requeue=false to avoid infinite loops if data is malformed
            channel.nack(msg, false, false);
        }
    });
}

module.exports = { startDonatedConsumer };
