const { getChannel, EXCHANGE } = require("../config/rabbitmq");
const axios = require("axios");

/**
 * Khi contract emit event FundingComplete(campaignId, totalRaisedWei):
 *  1. PUBLISH to RabbitMQ campaign.fundingComplete → campaign-service consume
 *     → compute allocations, create CampaignDonorShare records, seed refunds
 *  2. UPDATE campaign status → lifecycleStatus = "funding_complete"
 */
async function publishFundingComplete(eventData) {
    const { campaignId, totalRaisedWei, txHash, logIndex } = eventData;

    const channel = getChannel();
    if (channel) {
        const payload = {
            campaignOnChainId: Number(campaignId),
            totalRaisedWei: totalRaisedWei.toString(),
            fundingCompletedAt: new Date().toISOString(),
            txHash,
            logIndex: Number(logIndex),
        };
        channel.publish(
            EXCHANGE,
            process.env.RABBITMQ_RKEY_FUNDING_COMPLETE ||
                "campaign.fundingComplete",
            Buffer.from(JSON.stringify(payload)),
            { persistent: true },
        );
        console.log(
            `[listener-service] Published campaign.fundingComplete: campaignId=${campaignId}, ` +
                `totalRaisedWei=${totalRaisedWei}`,
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

module.exports = { publishFundingComplete };
