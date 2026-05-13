const { getChannel, EXCHANGE } = require("../config/rabbitmq");
const { Campaign, Donation } = require("../models");
const { recordTransaction } = require("../utils/recordTransaction");
const notificationService = require("../services/notification.service");

const QUEUE =
    process.env.RABBITMQ_QUEUE_CAMPAIGN_STOPPED || "campaign.stopped.queue";
const ROUTING_KEY =
    process.env.RABBITMQ_RKEY_CAMPAIGN_STOPPED || "campaign.stopped";

async function startCampaignStoppedConsumer() {
    const channel = getChannel();
    if (!channel) {
        console.warn(
            "[campaign-service] RabbitMQ channel unavailable. Skip campaign.stopped consumer",
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
                payload.campaignOnChainId ?? payload.campaignId,
            );
            if (!Number.isFinite(campaignOnChainId)) {
                throw new Error(
                    "Missing campaignId in campaign.stopped payload",
                );
            }

            const campaign = await Campaign.findOne({
                onChainId: campaignOnChainId,
            });
            if (campaign) {
                // Call handleCampaignCascadeFailure to update status and create refund records
                const { handleCampaignCascadeFailure } = require("../services/refundService");
                await handleCampaignCascadeFailure(campaignOnChainId);

                // --- Notify Creator ---
                if (campaign.creator) {
                    await notificationService.createNotification({
                        recipientWallet: campaign.creator,
                        type: "campaign_failed",
                        title: "Chiến dịch đã bị dừng",
                        message: `Chiến dịch "${campaign.title || `#${campaignOnChainId}`}" đã bị dừng. Những người ủng hộ có thể yêu cầu hoàn trả số tiền còn lại.`,
                        campaignOnChainId: Number(campaignOnChainId),
                        txHash: payload.txHash || "",
                    });
                }

                // --- Notify Donors ---
                try {
                    const uniqueDonors = await Donation.distinct("donorWallet", {
                        campaignOnChainId: Number(campaignOnChainId),
                    });

                    if (uniqueDonors.length > 0) {
                        const donorTitle = "Chiến dịch bạn ủng hộ đã bị dừng";
                        const donorMessage = `Chiến dịch "${campaign?.title || `#${campaignOnChainId}`}" đã bị dừng lại. Bạn có thể thực hiện yêu cầu hoàn lại tiền tại trang chi tiết chiến dịch.`;

                        await Promise.all(
                            uniqueDonors.map((donorWallet) =>
                                notificationService.createNotification({
                                    recipientWallet: donorWallet,
                                    type: "campaign_failed",
                                    title: donorTitle,
                                    message: donorMessage,
                                    campaignOnChainId: Number(campaignOnChainId),
                                    txHash: payload.txHash || "",
                                }),
                            ),
                        );
                    }
                } catch (notifyErr) {
                    console.error(`[campaign-service] Failed to notify donors for campaign stopped ${campaignOnChainId}:`, notifyErr.message);
                }

                await recordTransaction({
                    txHash: payload.txHash,
                    walletAddress: campaign.creator,
                    action: "campaignStop",
                    campaignOnChainId,
                    campaignTitle: campaign.title,
                });
            }

            channel.ack(msg);
        } catch (error) {
            console.error(
                "[campaign-service] campaignStopped consumer error:",
                error.message,
            );
            channel.nack(msg, false, false);
        }
    });
}

module.exports = { startCampaignStoppedConsumer };
