const { getChannel, EXCHANGE } = require("../config/rabbitmq");
const axios = require("axios");

/**
 * TODO: Implement sau khi Blockchain dev thêm event Donated vào FundRaising.sol
 *
 * Khi contract emit event Donated(campaignId, donor, amount):
 *  1. PUBLISH to RabbitMQ → donation-service consume → lưu MongoDB (async)
 *  2. PATCH transaction-service → update tx status = success (HTTP REST sync)
 */
async function publishDonated(eventData) {
    const { campaignId, donor, amount, txHash } = eventData;

    // 1. Publish to RabbitMQ (async – donation-service sẽ consume và lưu DB)
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
            "donation.received",
            Buffer.from(JSON.stringify(payload)),
            { persistent: true }
        );
        console.log(`[listener-service] Published donation.received: txHash=${txHash}`);
    }

    // 2. Cập nhật transaction status = success (HTTP REST sync)
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

module.exports = { publishDonated };
