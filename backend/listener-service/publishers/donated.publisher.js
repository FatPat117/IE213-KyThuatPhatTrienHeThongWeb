const { getChannel, EXCHANGE } = require("../config/rabbitmq");
const axios = require("axios");

/**
 * When the contract emits Donated(campaignId, donor, amount):
 * 1. Publish to RabbitMQ so donation-service can persist it.
 * 2. Patch transaction-service to mark the transaction as success.
 */
async function publishDonated(eventData) {
    const { campaignId, donor, amount, txHash, txContext } = eventData;

    const channel = getChannel();
    if (channel) {
        const amountBigInt = BigInt(amount);
        const amountEth = Number(amountBigInt) / 1e18;

        const payload = {
            txHash,
            campaignOnChainId: Number(campaignId),
            donorWallet: donor.toLowerCase(),
            amount: amountBigInt.toString(),
            amountEth,
            txContext,
        };

        channel.publish(
            EXCHANGE,
            process.env.RABBITMQ_RKEY_DONATED || "donation.received",
            Buffer.from(JSON.stringify(payload)),
            { persistent: true },
        );
        console.log(
            `[listener-service] Published donation.received: txHash=${txHash}`,
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

module.exports = { publishDonated };
