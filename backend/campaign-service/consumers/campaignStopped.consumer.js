const { getChannel, EXCHANGE } = require("../config/rabbitmq");
const { Campaign } = require("../models");
const { recordTransaction } = require("../utils/recordTransaction");

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
