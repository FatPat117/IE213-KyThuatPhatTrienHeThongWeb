const { getChannel, EXCHANGE } = require("../config/rabbitmq");
const axios = require("axios");

async function publishCampaignCreated(eventData) {
    const {
        campaignId,
        creator,
        beneficiary,
        goal,
        fundingDeadline,
        milestoneCount,
        txHash,
        blockNumber,
    } = eventData;

    const channel = getChannel();
    if (channel) {
        const payload = {
            onChainId: campaignId.toString(),
            creator,
            beneficiary,
            goalWei: goal.toString(),
            deadline: fundingDeadline.toString(),
            milestoneCount: milestoneCount.toString(),
            txHash,
            blockNumber: blockNumber?.toString?.() || "0",
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
                { status: "success" },
            );
        } catch (err) {
            console.error(
                "[listener-service] Could not update tx status:",
                err.message,
            );
        }
    }
}

module.exports = { publishCampaignCreated };
