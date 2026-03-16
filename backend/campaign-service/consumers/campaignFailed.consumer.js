const { getChannel, EXCHANGE } = require("../config/rabbitmq");
const campaignService = require("../services/campaign.service");
const notificationService = require("../services/notification.service");

const QUEUE = process.env.RABBITMQ_QUEUE_CAMP_FAILED || "campaign.failed.queue";
const ROUTING_KEY = process.env.RABBITMQ_RKEY_CAMP_FAILED || "campaign.failed";

/**
 * Lắng nghe event campaign.failed nội bộ do markFailed.job publish.
 * Cập nhật status = "failed" và gửi notification cho creator.
 */
async function startCampaignFailedConsumer() {
    const channel = getChannel();
    if (!channel) {
        console.warn(
            "[campaign-service] RabbitMQ channel không có – bỏ qua campaign.failed consumer",
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
            const { campaignOnChainId } = payload;

            const campaign = await campaignService.updateCampaignStatus(
                campaignOnChainId,
                "failed",
            );
            console.log(
                `[campaign-service] Campaign ${campaignOnChainId} → failed`,
            );

            if (campaign?.creator) {
                await notificationService.createNotification({
                    recipientWallet: campaign.creator,
                    type: "campaign_failed",
                    title: "Chiến dịch đã thất bại",
                    message: `Chiến dịch "${campaign.title || `#${campaignOnChainId}`}" đã hết hạn mà chưa đạt mục tiêu. Người quyên góp có thể yêu cầu hoàn tiền.`,
                    campaignOnChainId: Number(campaignOnChainId),
                    txHash: payload.txHash || "",
                });
            }

            channel.ack(msg);
        } catch (err) {
            console.error(
                "[campaign-service] campaignFailed consumer error:",
                err.message,
            );
            channel.nack(msg, false, false);
        }
    });
}

module.exports = { startCampaignFailedConsumer };
