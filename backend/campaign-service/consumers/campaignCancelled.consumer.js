const { getChannel, EXCHANGE } = require("../config/rabbitmq");
const campaignService = require("../services/campaign.service");

const QUEUE = process.env.RABBITMQ_QUEUE_CAMP_CANCELLED || "campaign.cancelled.queue";
const ROUTING_KEY = process.env.RABBITMQ_RKEY_CAMP_CANCELLED || "campaign.cancelled";

/**
 * Lắng nghe event CampaignCancelled từ listener-service.
 * Khi campaign bị huỷ → cập nhật status = "cancelled".
 */
async function startCampaignCancelledConsumer() {
    const channel = getChannel();
    if (!channel) {
        console.warn("[campaign-service] RabbitMQ channel không có – bỏ qua campaign.cancelled consumer");
        return;
    }

    await channel.assertQueue(QUEUE, { durable: true });
    await channel.bindQueue(QUEUE, EXCHANGE, ROUTING_KEY);
    channel.prefetch(1);

    console.log(`[campaign-service] Consumer đang lắng nghe queue: ${QUEUE}`);

    channel.consume(QUEUE, async (msg) => {
        if (!msg) return;
        try {
            const payload = JSON.parse(msg.content.toString());
            console.log("[campaign-service] Nhận event campaign.cancelled:", payload);

            await campaignService.updateCampaignStatus(payload.campaignOnChainId, "cancelled");
            console.log(`[campaign-service] Campaign ${payload.campaignOnChainId} → cancelled`);

            channel.ack(msg);
        } catch (err) {
            console.error("[campaign-service] campaignCancelled consumer error:", err.message);
            channel.nack(msg, false, false);
        }
    });
}

module.exports = { startCampaignCancelledConsumer };
