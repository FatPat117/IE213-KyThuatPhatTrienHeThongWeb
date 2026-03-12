const axios = require("axios");
const { getChannel, EXCHANGE } = require("../config/rabbitmq");

/**
 * When the contract emits CertificateMinted(campaignId, owner, tokenId):
 * 1. Publish the event to RabbitMQ so certificate-service can persist it.
 * 2. Mark the related transaction as successful in transaction-service.
 */
async function publishCertificateMinted(eventData) {
    const { tokenId, campaignId, owner, txHash } = eventData;

    const channel = getChannel();
    if (!channel) {
        console.warn(
            "[listener-service] publishCertificateMinted: RabbitMQ channel is unavailable.",
        );
    } else {
        const payload = {
            tokenId: Number(tokenId),
            campaignOnChainId: Number(campaignId),
            ownerWallet: owner.toLowerCase(),
            txHash,
        };

        channel.publish(
            EXCHANGE,
            process.env.RABBITMQ_RKEY_CERT_MINTED || "certificate.minted",
            Buffer.from(JSON.stringify(payload)),
            { persistent: true },
        );

        console.log(
            `[listener-service] Published certificate.minted event for tokenId=${tokenId}`,
        );
    }

    if (txHash) {
        try {
            await axios.patch(
                `${process.env.TRANSACTION_SERVICE_URL}/api/transactions/${txHash}/status`,
                { status: "success" },
            );
            console.log(
                `[listener-service] Updated transaction status to success for txHash=${txHash}`,
            );
        } catch (err) {
            console.error(
                "[listener-service] Failed to update transaction status for certificate mint:",
                err.message,
            );
        }
    }
}

module.exports = { publishCertificateMinted };
