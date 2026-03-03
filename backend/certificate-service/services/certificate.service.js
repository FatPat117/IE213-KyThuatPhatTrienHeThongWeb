const Certificate = require("../models/Certificate.model");

async function createCertificate(data) {
    const { tokenId, ...rest } = data;
    return Certificate.findOneAndUpdate(
        { tokenId },
        { $setOnInsert: { tokenId, ...rest } },
        { upsert: true, new: true }
    );
}

async function getCertificatesByOwner(ownerWallet) {
    return Certificate.find({ ownerWallet: ownerWallet.toLowerCase() })
        .sort({ mintedAt: -1 });
}

async function getCertificatesByCampaign(campaignOnChainId) {
    return Certificate.find({ campaignOnChainId: Number(campaignOnChainId) })
        .sort({ mintedAt: -1 });
}

async function getCertificateByTokenId(tokenId) {
    return Certificate.findOne({ tokenId: Number(tokenId) });
}

module.exports = {
    createCertificate,
    getCertificatesByOwner,
    getCertificatesByCampaign,
    getCertificateByTokenId,
};
