const { getChannel, EXCHANGE } = require("../config/rabbitmq");
const axios = require("axios");

/**
 * When the contract emits CampaignCreated(id, creator, beneficiary, goal, deadline):
 * 1. Publish to RabbitMQ for campaign-service persistence.
 * 2. Patch transaction-service to mark the transaction as success.
 */
async function publishCampaignCreated(eventData) {
    const {
        campaignId,
        creator,
        beneficiary,
        goal,
        deadline,
        txHash,
        txContext,
    } = eventData;

    const channel = getChannel();
    if (channel) {
        const payload = {
            onChainId: Number(campaignId),
            creator,
            beneficiary,
            goal: goal.toString(),
            deadline: Number(deadline),
            txHash,
            txContext,
        };
        channel.publish(
            EXCHANGE,
            process.env.RABBITMQ_RKEY_CAMP_CREATED || "campaign.created",
            Buffer.from(JSON.stringify(payload)),
            { persistent: true },
        );
        console.log(
            `[listener-service] Published campaign.created: campaignId=${campaignId}`,
        );
    }

    if (txHash) {
        try {
            await axios.patch(
                `${process.env.TRANSACTION_SERVICE_URL}/api/transactions/${txHash}/status`,
                { status: "success", txContext },
            );
        } catch (err) {
            console.error(
                "[listener-service] Failed to update transaction status:",
                err.message,
            );
        }
    }
}

module.exports = { publishCampaignCreated };
