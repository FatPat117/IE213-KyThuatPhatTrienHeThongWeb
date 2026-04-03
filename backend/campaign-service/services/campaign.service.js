const Campaign = require("../models/Campaign.model");

async function getAllCampaigns(filter = {}) {
    const query = {};
    if (filter.status) query.status = filter.status;
    if (filter.creator) query.creator = filter.creator.toLowerCase();

    return Campaign.find(query).sort({ createdAt: -1 });
}

async function getCampaignById(onChainId) {
    return Campaign.findOne({ onChainId: Number(onChainId) });
}

async function upsertCampaign(data) {
    const { onChainId, ...rest } = data;

    const normalized = {
        ...rest,
        goalWei: (rest.goalWei || rest.goal || "0").toString(),
        goal: (rest.goalWei || rest.goal || "0").toString(),
        totalRaisedWei: (rest.totalRaisedWei || rest.raised || "0").toString(),
        raised: (rest.totalRaisedWei || rest.raised || "0").toString(),
        totalDisbursedWei: (rest.totalDisbursedWei || "0").toString(),
    };

    return Campaign.findOneAndUpdate(
        { onChainId: Number(onChainId) },
        { $set: { onChainId: Number(onChainId), ...normalized } },
        { upsert: true, new: true, runValidators: true },
    );
}

async function updateCampaignStatus(onChainId, status) {
    return Campaign.findOneAndUpdate(
        { onChainId: Number(onChainId) },
        { $set: { status } },
        { new: true },
    );
}

async function updateRaised(onChainId, raisedWei) {
    return Campaign.findOneAndUpdate(
        { onChainId: Number(onChainId) },
        {
            $set: {
                totalRaisedWei: raisedWei.toString(),
                raised: raisedWei.toString(),
            },
        },
        { new: true },
    );
}

async function updateMetadata(onChainId, updates = {}) {
    const payload = { ...updates };

    if (payload.goalWei !== undefined) {
        payload.goal = payload.goalWei.toString();
    }

    if (payload.totalRaisedWei !== undefined) {
        payload.raised = payload.totalRaisedWei.toString();
    }

    return Campaign.findOneAndUpdate(
        { onChainId: Number(onChainId) },
        { $set: payload },
        { new: true, runValidators: true },
    );
}

module.exports = {
    getAllCampaigns,
    getCampaignById,
    upsertCampaign,
    updateCampaignStatus,
    updateRaised,
    updateMetadata,
};
