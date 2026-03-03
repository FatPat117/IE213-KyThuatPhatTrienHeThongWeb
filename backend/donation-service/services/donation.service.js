const Donation = require("../models/Donation.model");

async function createDonation(data) {
    // Dùng findOneAndUpdate để idempotent (blockchain có thể gửi lại event)
    const { txHash, ...rest } = data;
    return Donation.findOneAndUpdate(
        { txHash },
        { $setOnInsert: { txHash, ...rest } },
        { upsert: true, new: true }
    );
}

async function getDonationsByCampaign(campaignOnChainId) {
    return Donation.find({ campaignOnChainId: Number(campaignOnChainId) })
        .sort({ donatedAt: -1 });
}

async function getDonationsByDonor(donorWallet) {
    return Donation.find({ donorWallet: donorWallet.toLowerCase() })
        .sort({ donatedAt: -1 });
}

async function getTotalDonatedByCampaign(campaignOnChainId) {
    const result = await Donation.aggregate([
        { $match: { campaignOnChainId: Number(campaignOnChainId) } },
        { $group: { _id: null, total: { $sum: "$amountEth" } } },
    ]);
    return result[0]?.total || 0;
}

module.exports = {
    createDonation,
    getDonationsByCampaign,
    getDonationsByDonor,
    getTotalDonatedByCampaign,
};
