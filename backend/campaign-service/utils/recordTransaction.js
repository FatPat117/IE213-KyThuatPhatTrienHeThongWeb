const axios = require("axios");

async function recordTransaction({
    txHash,
    walletAddress,
    action,
    campaignOnChainId,
    campaignTitle,
}) {
    if (!txHash || !walletAddress || !action) {
        return;
    }

    const baseUrl =
        process.env.TRANSACTION_SERVICE_URL ||
        "http://transaction-service:4005";

    try {
        await axios.post(`${baseUrl}/api/transactions/internal/upsert`, {
            txHash,
            walletAddress,
            action,
            campaignOnChainId,
            campaignTitle,
        });
    } catch (error) {
        console.warn(
            `[campaign-service] Could not record transaction txHash=${txHash}: ${error.message}`,
        );
    }
}

module.exports = { recordTransaction };
