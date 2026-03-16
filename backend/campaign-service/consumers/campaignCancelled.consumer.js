const { getChannel, EXCHANGE } = require("../config/rabbitmq");
const campaignService = require("../services/campaign.service");
const notificationService = require("../services/notification.service");

const QUEUE =
    process.env.RABBITMQ_QUEUE_CAMP_CANCELLED || "campaign.cancelled.queue";
const ROUTING_KEY =
    process.env.RABBITMQ_RKEY_CAMP_CANCELLED || "campaign.cancelled";

/**
 * Lắng nghe event CampaignCancelled từ listener-service.
 * Khi campaign bị huỷ → cập nhật status = "cancelled".
 */
async function startCampaignCancelledConsumer() {
    const channel = getChannel();
    if (!channel) {
        console.warn(
            "[campaign-service] RabbitMQ channel không có – bỏ qua campaign.cancelled consumer",
        );
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
            console.log(
                "[campaign-service] Nhận event campaign.cancelled:",
                payload,
            );

            await campaignService.updateCampaignStatus(
                payload.campaignOnChainId,
                "cancelled",
            );
            console.log(
                `[campaign-service] Campaign ${payload.campaignOnChainId} → cancelled`,
            );

            // Gửi notification cho creator về việc chiến dịch bị hủy
            try {
                const campaign = await campaignService.getCampaignById(
                    payload.campaignOnChainId,
                );
                if (campaign?.creator) {
                    await notificationService.createNotification({
                        recipientWallet: campaign.creator,
                        type: "campaign_cancelled",
                        title: "Chiến dịch đã bị hủy",
                        message: `Chiến dịch "${campaign.title || `#${payload.campaignOnChainId}`}" đã bị hủy.`,
                        campaignOnChainId: payload.campaignOnChainId,
                        txHash: payload.txHash || "",
                    });
                }
            } catch (notifErr) {
                console.warn(
                    "[campaign-service] Không thể gửi notification campaign_cancelled:",
                    notifErr.message,
                );
            }

            channel.ack(msg);
        } catch (err) {
            console.error(
                "[campaign-service] campaignCancelled consumer error:",
                err.message,
            );
            channel.nack(msg, false, false);
        }
    });
}

module.exports = { startCampaignCancelledConsumer };
