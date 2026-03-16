const axios = require("axios");

const TRANSACTION_SERVICE_URL =
    process.env.TRANSACTION_SERVICE_URL || "http://transaction-service:4005";

/**
 * Khi contract emit event RefundIssued(campaignId, donor, amount):
 * Upsert transaction-service → ghi nhận action claimRefund với status success.
 * (Không cần publish RabbitMQ vì không có consumer cần event này)
 */
async function publishRefundIssued(eventData) {
    const { campaignId, donor, amount, txHash } = eventData;

    if (!txHash || !donor) return;

    try {
        await axios.post(
            `${TRANSACTION_SERVICE_URL}/api/transactions/internal/upsert`,
            {
                txHash,
                walletAddress: donor.toLowerCase(),
                action: "claimRefund",
                campaignOnChainId: Number(campaignId),
            },
        );
        console.log(
            `[listener-service] Upserted claimRefund tx: campaignId=${campaignId}, donor=${donor}`,
        );
    } catch (err) {
        console.error(
            "[listener-service] publishRefundIssued: failed to upsert tx:",
            err.message,
        );
    }
}

module.exports = { publishRefundIssued };
