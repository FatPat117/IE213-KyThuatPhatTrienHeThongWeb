const Certificate = require("../models/Certificate.model");

async function createCertificate(data) {
    const { tokenId, ...rest } = data;
    return Certificate.findOneAndUpdate(
        { tokenId },
        { $setOnInsert: { tokenId, ...rest } },
        { upsert: true, new: true },
    );
}

async function getCertificatesByOwner(ownerWallet, options = {}) {
    const page = Math.max(Number(options.page) || 1, 1);
    const limit = Math.min(Math.max(Number(options.limit) || 20, 1), 100);
    const skip = (page - 1) * limit;
    const filter = { ownerWallet: ownerWallet.toLowerCase() };

    const [totalItems, items] = await Promise.all([
        Certificate.countDocuments(filter),
        Certificate.find(filter).sort({ mintedAt: -1 }).skip(skip).limit(limit),
    ]);

    return {
        items,
        totalItems,
        totalPages: totalItems > 0 ? Math.ceil(totalItems / limit) : 0,
        currentPage: page,
    };
}

async function getCertificatesByCampaign(campaignOnChainId, options = {}) {
    const page = Math.max(Number(options.page) || 1, 1);
    const limit = Math.min(Math.max(Number(options.limit) || 20, 1), 100);
    const skip = (page - 1) * limit;
    const filter = { campaignOnChainId: Number(campaignOnChainId) };

    const [totalItems, items] = await Promise.all([
        Certificate.countDocuments(filter),
        Certificate.find(filter).sort({ mintedAt: -1 }).skip(skip).limit(limit),
    ]);

    return {
        items,
        totalItems,
        totalPages: totalItems > 0 ? Math.ceil(totalItems / limit) : 0,
        currentPage: page,
    };
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
