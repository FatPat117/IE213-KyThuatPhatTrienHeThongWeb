const { getChannel, EXCHANGE } = require("../config/rabbitmq");
const axios = require("axios");

/**
 * Khi contract emit event CampaignCancelled(campaignId, cancelledBy):
 *  1. PUBLISH to RabbitMQ → campaign-service consume → cập nhật status = cancelled (async)
 *  2. Upsert transaction-service với action cancelCampaign (HTTP REST sync)
 */
async function publishCampaignCancelled(eventData) {
    const { campaignId, cancelledBy, txHash } = eventData;

    const channel = getChannel();
    if (!channel) {
        console.warn(
            "[listener-service] publishCampaignCancelled: RabbitMQ channel không có",
        );
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
        { persistent: true },
    );
    console.log(
        `[listener-service] Published campaign.cancelled: campaignId=${campaignId}`,
    );

    // Upsert tx cancelCampaign (frontend không tạo pending trước)
    if (txHash && cancelledBy) {
        try {
            await axios.post(
                `${process.env.TRANSACTION_SERVICE_URL}/api/transactions/internal/upsert`,
                {
                    txHash,
                    walletAddress: cancelledBy.toLowerCase(),
                    action: "cancelCampaign",
                    campaignOnChainId: Number(campaignId),
                },
            );
        } catch (err) {
            console.error(
                "[listener-service] Không thể upsert tx cancelCampaign:",
                err.message,
            );
        }
    }
}

module.exports = { publishCampaignCancelled };
