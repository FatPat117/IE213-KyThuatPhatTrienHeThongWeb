const { getChannel, EXCHANGE } = require("../config/rabbitmq");
const campaignService = require("../services/campaign.service");
const notificationService = require("../services/notification.service");

const QUEUE =
    process.env.RABBITMQ_QUEUE_CAMP_CANCELLED || "campaign.cancelled.queue";
const ROUTING_KEY =
    process.env.RABBITMQ_RKEY_CAMP_CANCELLED || "campaign.cancelled";

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

            await campaignService.updateCampaignStatus(
                campaignOnChainId,
                "cancelled",
            );
            console.log(
                `[campaign-service] Campaign ${campaignOnChainId} -> cancelled`,
            );

            try {
                const campaign =
                    await campaignService.getCampaignById(campaignOnChainId);
                if (campaign?.creator) {
                    await notificationService.createNotification({
                        recipientWallet: campaign.creator,
                        type: "campaign_cancelled",
                        title: "Campaign cancelled",
                        message: `Campaign "${campaign.title || `#${campaignOnChainId}`}" was cancelled.`,
                        campaignOnChainId,
                        txHash: payload.txHash || "",
                    });
                }
            } catch (notifErr) {
                console.warn(
                    "[campaign-service] Failed to create campaign_cancelled notification:",
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
