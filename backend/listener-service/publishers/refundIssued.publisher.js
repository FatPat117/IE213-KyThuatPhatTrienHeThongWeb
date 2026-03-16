const { getChannel, EXCHANGE } = require("../config/rabbitmq");

/**
 * Khi contract emit event RefundIssued(campaignId, donor, amount):
 * Publish RabbitMQ → transaction-service consume để ghi action claimRefund.
 */
async function publishRefundIssued(eventData) {
    const { campaignId, donor, amount, txHash } = eventData;

    if (!txHash || !donor || amount === undefined || amount === null) return;

    const channel = getChannel();
    if (!channel) {
        console.warn(
            "[listener-service] publishRefundIssued: RabbitMQ channel không có",
        );
        return;
    }

    const amountBigInt = BigInt(amount);
    const payload = {
        campaignOnChainId: Number(campaignId),
        donorWallet: donor.toLowerCase(),
        amount: amountBigInt.toString(),
        amountEth: Number(amountBigInt) / 1e18,
        txHash,
    };

    channel.publish(
        EXCHANGE,
        process.env.RABBITMQ_RKEY_REFUND_ISSUED || "refund.issued",
        Buffer.from(JSON.stringify(payload)),
        { persistent: true },
    );

    console.log(
        `[listener-service] Published refund.issued: campaignId=${campaignId}, donor=${donor}`,
    );
}

module.exports = { publishRefundIssued };
