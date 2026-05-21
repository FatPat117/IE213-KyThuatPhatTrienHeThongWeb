const { getChannel, EXCHANGE } = require("../config/rabbitmq");

async function publishCampaignFailed(payload) {
    const channel = getChannel();
    if (!channel) {
        return false;
    }

    channel.publish(
        EXCHANGE,
        "campaign.failed",
        Buffer.from(JSON.stringify(payload)),
        { persistent: true },
    );

    return true;
}

module.exports = { publishCampaignFailed };
