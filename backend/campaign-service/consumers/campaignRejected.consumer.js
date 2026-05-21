const { getChannel, EXCHANGE } = require("../config/rabbitmq");
const { Campaign } = require("../models");
const notificationService = require("../services/notification.service");

const QUEUE = "campaign.rejected.queue";
const ROUTING_KEY = "campaign.rejected";

async function startCampaignRejectedConsumer() {
    const channel = getChannel();
    if (!channel) return;

    await channel.assertQueue(QUEUE, { durable: true });
    await channel.bindQueue(QUEUE, EXCHANGE, ROUTING_KEY);
    channel.prefetch(1);

    channel.consume(QUEUE, async (msg) => {
        if (!msg) return;
        try {
            const payload = JSON.parse(msg.content.toString());
            const onChainId = Number(payload.campaignId || payload.campaignOnChainId);
            if (!Number.isFinite(onChainId)) {
                throw new Error("Invalid campaignId");
            }

            const { reason, rejectedBy, txHash } = payload;

            const campaign = await Campaign.findOneAndUpdate(
                { onChainId },
                { 
                    $set: { 
                        status: "cancelled",
                        rejectionReason: reason || "No reason provided",
                        rejectedAt: new Date()
                    } 
                },
                { new: true },
            );

            if (campaign?.creator) {
                await notificationService.createNotification({
                    recipientWallet: campaign.creator,
                    type: "campaign_rejected",
                    title: "Chiến dịch đã bị từ chối chính thức",
                    message: `Chiến dịch #${onChainId} đã bị từ chối chính thức trên Blockchain. Bấm để xem chi tiết.`,
                    campaignOnChainId: onChainId,
                    txHash: txHash || "",
                });
            }

            channel.ack(msg);
        } catch (error) {
            console.error("[campaign-service] campaignRejected consumer error:", error.message);
            channel.nack(msg, false, false);
        }
    });
}

module.exports = { startCampaignRejectedConsumer };
