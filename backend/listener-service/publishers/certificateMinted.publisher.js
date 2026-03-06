const { getChannel, EXCHANGE } = require("../config/rabbitmq");

/**
 * TODO: Implement sau khi NFT contract (ERC-721) được viết và deploy
 *
 * Khi contract emit event CertificateMinted(tokenId, campaignId, owner, metadataUri):
 *  1. PUBLISH to RabbitMQ → certificate-service consume → lưu MongoDB (async)
 */
async function publishCertificateMinted(eventData) {
    // TODO: Uncomment và implement khi NFT contract sẵn sàng
    // const { tokenId, campaignId, owner, metadataUri } = eventData;
    // const channel = getChannel();
    // if (channel) {
    //   const payload = {
    //     tokenId: Number(tokenId),
    //     campaignOnChainId: Number(campaignId),
    //     ownerWallet: owner.toLowerCase(),
    //     metadataUri,
    //   };
    //   channel.publish(EXCHANGE, 'certificate.minted', Buffer.from(JSON.stringify(payload)), { persistent: true });
    // }
    console.warn("[listener-service] publishCertificateMinted: TODO – NFT contract chưa triển khai");
}

module.exports = { publishCertificateMinted };
