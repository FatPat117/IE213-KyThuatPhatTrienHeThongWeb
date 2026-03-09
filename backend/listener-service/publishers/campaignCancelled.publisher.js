const { getChannel, EXCHANGE } = require("../config/rabbitmq");

/**
 * Khi contract emit event CampaignCancelled(campaignId, cancelledBy):
 * PUBLISH to RabbitMQ → campaign-service consume → cập nhật status = cancelled (async)
 */
async function publishCampaignCancelled(eventData) {
    const { campaignId, cancelledBy, txHash } = eventData;

    const channel = getChannel();
    if (!channel) {
        console.warn("[listener-service] publishCampaignCancelled: RabbitMQ channel không có");
        return;
    }

    const payload = {
        campaignOnChainId: Number(campaignId),
        cancelledBy: cancelledBy.toLowerCase(),
        txHash,
    };

    channel.publish(
        EXCHANGE,
        process.env.RABBITMQ_RKEY_CAMP_CANCELLED || "campaign.cancelled",
        Buffer.from(JSON.stringify(payload)),
        { persistent: true }
    );
    console.log(`[listener-service] Published campaign.cancelled: campaignId=${campaignId}`);
}

module.exports = { publishCampaignCancelled };
