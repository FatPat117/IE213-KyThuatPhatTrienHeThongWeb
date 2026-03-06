const { getChannel, EXCHANGE } = require("../config/rabbitmq");
const axios = require("axios");

/**
 * Khi contract emit event FundsWithdrawn(campaignId, beneficiary, amount):
 *  1. PUBLISH to RabbitMQ → campaign-service consume → cập nhật status = ended (async)
 *  2. PATCH transaction-service → update tx status = success (HTTP REST sync)
 */
async function publishFundsWithdrawn(eventData) {
    const { campaignId, beneficiary, amount, txHash } = eventData;

    const channel = getChannel();
    if (channel) {
        const amountBigInt = BigInt(amount);
        const payload = {
            campaignOnChainId: Number(campaignId),
            beneficiary: beneficiary.toLowerCase(),
            amount: amountBigInt.toString(),
            amountEth: Number(amountBigInt) / 1e18,
            txHash,
        };

        channel.publish(
            EXCHANGE,
            "funds.withdrawn",
            Buffer.from(JSON.stringify(payload)),
            { persistent: true }
        );
        console.log(`[listener-service] Published funds.withdrawn: campaignId=${campaignId}`);
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

module.exports = { publishFundsWithdrawn };
