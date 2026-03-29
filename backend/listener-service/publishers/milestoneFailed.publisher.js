const { getChannel, EXCHANGE } = require("../config/rabbitmq");

/**
 * Publish MilestoneFailed event to RabbitMQ
 * Triggers cascade failure: 1 milestone fail → campaign fail → all donors refund pro-rata
 *
 * @param {Object} event Event data from contract
 * @param {number} event.campaignId - Campaign on-chain ID
 * @param {number} event.milestoneId - Milestone index (1-based)
 * @param {string} event.markedBy - Address of reviewer who marked it failed
 * @param {string} event.amount - Amount allocated to this milestone (wei as string)
 * @param {string} event.txHash - Transaction hash
 * @param {number} event.logIndex - Log index in transaction
 * @param {number} event.blockNumber - Block number
 */
async function publishMilestoneFailed(event) {
    try {
        const channel = getChannel();
        if (!channel) {
            throw new Error("RabbitMQ channel not available");
        }

        const exchangeName = EXCHANGE || "funding.events";
        const routingKey = "blockchain.milestone.failed";

        const message = {
            campaignId: event.campaignId,
            milestoneId: event.milestoneId,
            markedBy: event.markedBy,
            amount: event.amount,
            txHash: event.txHash,
            logIndex: event.logIndex,
            blockNumber: event.blockNumber,
            publishedAt: new Date().toISOString(),
        };

        channel.publish(
            exchangeName,
            routingKey,
            Buffer.from(JSON.stringify(message)),
            { persistent: true },
        );

        console.log(
            `[milestoneFailed.publisher] Published: ` +
                `campaignId=${event.campaignId}, milestoneId=${event.milestoneId}, ` +
                `to routing key '${routingKey}'`,
        );
    } catch (error) {
        console.error(`[milestoneFailed.publisher] Error: ${error.message}`);
        throw error;
    }
}

module.exports = { publishMilestoneFailed };
