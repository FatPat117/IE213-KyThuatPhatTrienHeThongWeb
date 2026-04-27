const { getChannel, EXCHANGE } = require("../config/rabbitmq");
const axios = require("axios");

/**
 * Khi contract emit event MilestoneRefunded(campaignId, milestoneId, donorAddress, refundedWei):
 *  1. PUBLISH to RabbitMQ campaign.milestoneRefunded → campaign-service consume
 *     → finalize MilestoneRefund record, update status to 'refunded', track audit trail
 *  2. UPDATE transaction-service with success status
 */
async function publishMilestoneRefunded(eventData) {
    const {
        campaignId,
        milestoneId,
        donorAddress,
        refundedWei,
        txHash,
        logIndex,
    } = eventData;

    const channel = getChannel();
    if (channel) {
        const payload = {
            campaignOnChainId: Number(campaignId),
            milestoneIndex: Number(milestoneId), // Convert to milestone index if needed
            donorAddress,
            refundedWei: refundedWei.toString(),
            txHash,
            logIndex: Number(logIndex),
            refundedAt: new Date().toISOString(),
        };
        channel.publish(
            EXCHANGE,
            process.env.RABBITMQ_RKEY_MILESTONE_REFUNDED ||
                "campaign.milestoneRefunded",
            Buffer.from(JSON.stringify(payload)),
            { persistent: true },
        );
        console.log(
            `[listener-service] Published campaign.milestoneRefunded: campaignId=${campaignId}, ` +
                `donor=${donorAddress}, refundedWei=${refundedWei}`,
        );
    }

    if (txHash) {
        try {
            await axios.patch(
                `${process.env.TRANSACTION_SERVICE_URL}/api/transactions/${txHash}/status`,
                { status: "success" },
            );
        } catch (err) {
            console.error(
                "[listener-service] Không thể cập nhật tx status:",
                err.message,
            );
        }
    }
}

module.exports = { publishMilestoneRefunded };
