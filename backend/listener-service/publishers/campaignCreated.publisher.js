const { getChannel, EXCHANGE } = require("../config/rabbitmq");
const axios = require("axios");

/**
 * TODO: Implement sau khi Blockchain dev thêm event CampaignCreated vào FundRaising.sol
 *
 * Khi contract emit event CampaignCreated(campaignId, creator, title, goal, deadline):
 *  1. PUBLISH to RabbitMQ → campaign-service consume → lưu MongoDB (async)
 *  2. PATCH transaction-service → update tx status = success (HTTP REST sync)
 */
async function publishCampaignCreated(eventData) {
    const { campaignId, creator, title, goal, deadline, txHash } = eventData;

    // 1. Publish to RabbitMQ (async – campaign-service sẽ consume và lưu DB)
    const channel = getChannel();
    if (channel) {
        const payload = {
            onChainId: Number(campaignId),
            title,
            creator,
            goal: goal.toString(), // wei dạng string
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

    // 2. Cập nhật transaction status = success (HTTP REST sync)
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
