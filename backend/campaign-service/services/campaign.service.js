const Campaign = require("../models/Campaign.model");

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
        { upsert: true, new: true, runValidators: true }
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
        { new: true }
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
        { new: true }
    );
}

module.exports = {
    getAllCampaigns,
    getCampaignById,
    upsertCampaign,
    updateCampaignStatus,
    updateRaised,
};
