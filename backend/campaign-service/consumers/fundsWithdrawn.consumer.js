const { getChannel, EXCHANGE } = require("../config/rabbitmq");
const campaignService = require("../services/campaign.service");
const notificationService = require("../services/notification.service");

const QUEUE =
    process.env.RABBITMQ_QUEUE_CAMP_WITHDRAWN || "funds.withdrawn.queue";
const ROUTING_KEY = process.env.RABBITMQ_RKEY_WITHDRAWN || "funds.withdrawn";

/**
 * Listen for FundsWithdrawn and mark campaign as completed.
 */
async function startFundsWithdrawnConsumer() {
    const channel = getChannel();
    if (!channel) {
        console.warn(
            "[campaign-service] RabbitMQ channel unavailable. Skip funds.withdrawn consumer.",
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
                    "Missing campaignId in funds.withdrawn payload",
                );
            }

            await campaignService.updateCampaignStatus(
                campaignOnChainId,
                "completed",
            );
            console.log(
                `[campaign-service] Campaign ${campaignOnChainId} -> completed (funds withdrawn)`,
            );

            try {
                const campaign =
                    await campaignService.getCampaignById(campaignOnChainId);
                if (campaign?.creator) {
                    const amountDisplay = payload.amountEth
                        ? `${payload.amountEth} ETH`
                        : "";
                    await notificationService.createNotification({
                        recipientWallet: campaign.creator,
                        type: "funds_withdrawn",
                        title: "Funds withdrawn",
                        message: `Campaign "${campaign.title || `#${campaignOnChainId}`}" withdrew ${amountDisplay}.`,
                        campaignOnChainId,
                        txHash: payload.txHash || "",
                    });
                }
            } catch (notifErr) {
                console.warn(
                    "[campaign-service] Failed to create funds_withdrawn notification:",
                    notifErr.message,
                );
            }

            channel.ack(msg);
        } catch (err) {
            console.error(
                "[campaign-service] fundsWithdrawn consumer error:",
                err.message,
            );
            channel.nack(msg, false, false);
        }
    });
}

module.exports = { startFundsWithdrawnConsumer };
