const { Campaign, Milestone } = require("../models");
/**
 * Lấy tất cả campaigns, có thể filter theo status.
 * @param {object} filter - { status: 'active' | 'ended' | 'failed' } (optional)
 */
async function getAllCampaigns(filter = {}) {
    const query = {};
    if (filter.status) query.status = filter.status;
    if (filter.creator) query.creator = filter.creator.toLowerCase();
    return Campaign.find(query).sort({ createdAt: -1 });
}

/**
 * Lấy 1 campaign theo onChainId.
 * @param {number} onChainId
 */
async function getCampaignById(onChainId) {
    return Campaign.findOne({ onChainId: Number(onChainId) });
}

/**
 * Upsert campaign – tạo mới nếu chưa có, cập nhật nếu đã có.
 * Được gọi bởi consumer khi nhận event CampaignCreated từ RabbitMQ.
 * @param {object} data - { onChainId, title, description, creator, goal, deadline }
 */
async function upsertCampaign(data) {
    const { onChainId, ...rest } = data;
    return Campaign.findOneAndUpdate(
        { onChainId: Number(onChainId) },
        { $set: { onChainId: Number(onChainId), ...rest } },
        { upsert: true, new: true, runValidators: true },
    );
}

/**
 * Cập nhật trạng thái campaign (active → ended/failed).
 * @param {number} onChainId
 * @param {string} status
 */
async function updateCampaignStatus(onChainId, status) {
    return Campaign.findOneAndUpdate(
        { onChainId: Number(onChainId) },
        { $set: { status } },
        { new: true },
    );
}

/**
 * Cập nhật số tiền đã raised.
 * Được gọi khi nhận event Donated.
 * @param {number} onChainId
 * @param {string} raisedWei - tổng mới, lấy từ blockchain
 */
async function updateRaised(onChainId, raisedWei) {
    return Campaign.findOneAndUpdate(
        { onChainId: Number(onChainId) },
        { $set: { raised: raisedWei } },
        { new: true },
    );
}

/**
 * Cập nhật metadata off-chain (description, images).
 * @param {number} onChainId
 * @param {object} updates - { description?, images? }
 */
async function updateMetadata(onChainId, updates = {}) {
    return Campaign.findOneAndUpdate(
        { onChainId: Number(onChainId) },
        { $set: updates },
        { new: true, runValidators: true },
    );
}

/**
 * Tạo campaign kèm milestones off-chain trong 1 transaction.
 * @param {object} payload
 * @param {number} payload.onChainId
 * @param {string} payload.title
 * @param {string} payload.description
 * @param {string} payload.creator
 * @param {string} payload.beneficiary
 * @param {string} payload.goal
 * @param {Date|string|number} payload.deadline
 * @param {Array} payload.milestones
 */
async function createCampaignWithMilestones(payload) {
    const {
        onChainId,
        title,
        description = "",
        creator,
        beneficiary = null,
        goal,
        deadline,
        milestones = [],
    } = payload;

    const existed = await Campaign.findOne({ onChainId: Number(onChainId) });
    if (existed) {
        const err = new Error("Campaign đã tồn tại");
        err.statusCode = 409;
        throw err;
    }

    const campaign = await Campaign.create({
        onChainId: Number(onChainId),
        title,
        description,
        creator: creator.toLowerCase(),
        beneficiary: beneficiary ? beneficiary.toLowerCase() : null,
        goal: String(goal),
        deadline: new Date(deadline),
        status: "active",
        lifecycleStatus: "draft",
    });

    const milestoneDocs = milestones.map((m, idx) => ({
        campaignId: campaign._id,
        campaignOnChainId: Number(onChainId),
        milestoneIndex: Number(m.milestoneIndex || idx + 1),
        title: m.title || `Milestone ${idx + 1}`,
        description: m.description || "",
        financialTargetWei: String(m.financialTargetWei || "0"),
        deadline: new Date(m.deadline || deadline),
        status: "pending_funding",
    }));

    let createdMilestones = [];
    try {
        if (milestoneDocs.length) {
            createdMilestones = await Milestone.insertMany(milestoneDocs, {
                ordered: true,
            });

            campaign.milestoneIds = createdMilestones.map((x) => x._id);
            await campaign.save();
        }
    } catch (error) {
        await Milestone.deleteMany({
            campaignOnChainId: Number(onChainId),
            campaignId: campaign._id,
        });
        await Campaign.deleteOne({ _id: campaign._id });
        throw error;
    }

    return { campaign, milestones: createdMilestones };
}

module.exports = {
    getAllCampaigns,
    getCampaignById,
    upsertCampaign,
    updateCampaignStatus,
    updateRaised,
    updateMetadata,
    createCampaignWithMilestones,
};
