const { getChannel, EXCHANGE } = require("../config/rabbitmq");

async function publishMilestoneFailed(payload) {
    const channel = getChannel();
    if (!channel) {
        return false;
    }

    channel.publish(
        EXCHANGE,
        "blockchain.milestone.failed",
        Buffer.from(JSON.stringify(payload)),
        { persistent: true },
    );

    return true;
}

module.exports = { publishMilestoneFailed };
