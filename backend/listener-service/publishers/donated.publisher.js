const { getChannel, EXCHANGE } = require("../config/rabbitmq");
const axios = require("axios");

/**
 * Khi contract emit event Donated(campaignId, donor, amount):
 *  1. PUBLISH to RabbitMQ → donation-service consume → lưu MongoDB (async)
 *  2. PATCH transaction-service → update tx status = success (HTTP REST sync)
 */
async function publishDonated(eventData) {
    const { campaignId, donor, amount, txHash } = eventData;

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

module.exports = { publishDonated };
