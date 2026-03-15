const { getChannel, EXCHANGE } = require("../config/rabbitmq");
const axios = require("axios");

/**
 * When the contract emits FundsWithdrawn(campaignId, beneficiary, amount):
 * 1. Publish to RabbitMQ so campaign-service can update campaign status.
 * 2. Patch transaction-service to mark the transaction as success.
 */
async function publishFundsWithdrawn(eventData) {
    const { campaignId, beneficiary, amount, txHash, txContext } = eventData;

    const channel = getChannel();
    if (channel) {
        const amountBigInt = BigInt(amount);
        const payload = {
            campaignOnChainId: Number(campaignId),
            beneficiary: beneficiary.toLowerCase(),
            amount: amountBigInt.toString(),
            amountEth: Number(amountBigInt) / 1e18,
            txHash,
            txContext,
        };

        channel.publish(
            EXCHANGE,
            process.env.RABBITMQ_RKEY_WITHDRAWN || "funds.withdrawn",
            Buffer.from(JSON.stringify(payload)),
            { persistent: true },
        );
        console.log(
            `[listener-service] Published funds.withdrawn: campaignId=${campaignId}`,
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

module.exports = { publishFundsWithdrawn };
