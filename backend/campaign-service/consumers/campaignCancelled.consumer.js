const { getChannel, EXCHANGE } = require("../config/rabbitmq");
const campaignService = require("../services/campaign.service");
const notificationService = require("../services/notification.service");

const QUEUE =
    process.env.RABBITMQ_QUEUE_CAMP_CANCELLED ||
    "campaign.cancelled.queue";

const ROUTING_KEY =
    process.env.RABBITMQ_RKEY_CAMP_CANCELLED ||
    "campaign.cancelled";

async function startCampaignCancelledConsumer() {
    const channel = getChannel();

    if (!channel) {
        console.warn(
            "[campaign-service] RabbitMQ channel unavailable. Skip campaign.cancelled consumer.",
        );
        return;
    }

    await channel.assertQueue(QUEUE, { durable: true });
    await channel.bindQueue(QUEUE, EXCHANGE, ROUTING_KEY);

    channel.prefetch(1);

    console.log(
        `[campaign-service] Listening for ${ROUTING_KEY} on queue: ${QUEUE}`,
    );

    channel.consume(QUEUE, async (msg) => {
        if (!msg) return;

        try {
            const payload = JSON.parse(msg.content.toString());

            const campaignOnChainId = Number(
                payload.campaignId || payload.campaignOnChainId,
            );

            if (!Number.isFinite(campaignOnChainId)) {
                throw new Error(
                    "Missing campaignId in campaign.cancelled payload",
                );
            }

            // Update campaign status
            await campaignService.updateCampaignStatus(
                campaignOnChainId,
                "cancelled",
            );

            console.log(
                `[campaign-service] Campaign ${campaignOnChainId} -> cancelled`,
            );

            // Get campaign info
            const campaign =
                await campaignService.getCampaignById(campaignOnChainId);

            // Notify campaign creator
            try {
                if (campaign?.creator) {
                    await notificationService.createNotification({
                        recipientWallet: campaign.creator,
                        type: "campaign_cancelled",
                        title: "Chiến dịch đã bị hủy",
                        message: `Chiến dịch "${campaign.title || `#${campaignOnChainId}`}" đã bị hủy bỏ bởi quản trị viên hoặc chủ sở hữu.`,
                        campaignOnChainId,
                        txHash: payload.txHash || "",
                    });
                }
            } catch (notifErr) {
                console.warn(
                    "[campaign-service] Failed to notify campaign creator:",
                    notifErr.message,
                );
            }

            // Notify donors
            try {
                const { Donation } = require("../models");

                const uniqueDonors = await Donation.distinct(
                    "donorWallet",
                    {
                        campaignOnChainId: Number(campaignOnChainId),
                    },
                );

                if (uniqueDonors.length > 0) {
                    const donorTitle =
                        "Chiến dịch bạn ủng hộ đã bị hủy";

                    const donorMessage = `Chiến dịch "${campaign?.title || `#${campaignOnChainId}`}" đã bị hủy bỏ. Bạn có thể thực hiện yêu cầu hoàn lại tiền tại trang chi tiết chiến dịch.`;

                    await Promise.all(
                        uniqueDonors.map((donorWallet) =>
                            notificationService.createNotification({
                                recipientWallet: donorWallet,
                                type: "campaign_failed",
                                title: donorTitle,
                                message: donorMessage,
                                campaignOnChainId:
                                    Number(campaignOnChainId),
                                txHash: payload.txHash || "",
                            }),
                        ),
                    );
                }
            } catch (notifyErr) {
                console.error(
                    `[campaign-service] Failed to notify donors for campaign cancelled ${campaignOnChainId}:`,
                    notifyErr.message,
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
