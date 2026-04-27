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
            process.env.RABBITMQ_RKEY_WITHDRAWN || "funds.withdrawn",
            Buffer.from(JSON.stringify(payload)),
            { persistent: true },
        );
        console.log(
            `[listener-service] Published funds.withdrawn: campaignId=${campaignId}`,
        );
    }

    // Upsert tx withdrawFunds (frontend không tạo pending trước)
    if (txHash && beneficiary) {
        try {
            await axios.post(
                `${process.env.TRANSACTION_SERVICE_URL}/api/transactions/internal/upsert`,
                {
                    txHash,
                    walletAddress: beneficiary.toLowerCase(),
                    action: "withdrawFunds",
                    campaignOnChainId: Number(campaignId),
                },
            );
        } catch (err) {
            console.error(
                "[listener-service] Không thể upsert tx withdrawFunds:",
                err.message,
            );
        }
    }
}

module.exports = { publishFundsWithdrawn };
