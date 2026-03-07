const { getChannel, EXCHANGE } = require("../config/rabbitmq");
const axios = require("axios");

/**
 * Khi contract emit event CampaignCreated(id, creator, beneficiary, goal, deadline):
 *  1. PUBLISH to RabbitMQ → campaign-service consume → lưu MongoDB (async)
 *  2. PATCH transaction-service → update tx status = success (HTTP REST sync)
 */
async function publishCampaignCreated(eventData) {
    const { campaignId, creator, beneficiary, goal, deadline, txHash } = eventData;

    const channel = getChannel();
    if (channel) {
        const payload = {
            onChainId: Number(campaignId),
            creator,
            beneficiary,
            goal: goal.toString(),
            deadline: Number(deadline),
            txHash,
        };
        channel.publish(
            EXCHANGE,
            "campaign.created",
            Buffer.from(JSON.stringify(payload)),
            { persistent: true }
        );
        console.log(`[listener-service] Published campaign.created: campaignId=${campaignId}`);
    }

    if (txHash) {
        try {
            await axios.patch(
                `${process.env.TRANSACTION_SERVICE_URL}/api/transactions/${txHash}/status`,
                { status: "success" }
            );
        } catch (err) {
            console.error("[listener-service] Không thể cập nhật tx status:", err.message);
        }
    }
}

module.exports = { publishCampaignCreated };
