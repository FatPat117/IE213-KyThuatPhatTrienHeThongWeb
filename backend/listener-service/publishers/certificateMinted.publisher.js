const { getChannel, EXCHANGE } = require("../config/rabbitmq");

/**
 * Khi contract emit event CertificateMinted(campaignId, owner, tokenId):
 * PUBLISH to RabbitMQ → certificate-service consume → lưu MongoDB (async)
 */
async function publishCertificateMinted(eventData) {
    const { tokenId, campaignId, owner, txHash } = eventData;

    const channel = getChannel();
    if (!channel) {
        console.warn("[listener-service] publishCertificateMinted: RabbitMQ channel không có");
        return;
    }

    const payload = {
        tokenId: Number(tokenId),
        campaignOnChainId: Number(campaignId),
        ownerWallet: owner.toLowerCase(),
        txHash,
    };

    channel.publish(
        EXCHANGE,
        "certificate.minted",
        Buffer.from(JSON.stringify(payload)),
        { persistent: true }
    );
    console.log(`[listener-service] Published certificate.minted: tokenId=${tokenId}`);
}

module.exports = { publishCertificateMinted };
