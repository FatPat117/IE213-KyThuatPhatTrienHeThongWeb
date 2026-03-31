const campaignService = require("../services/campaign.service");
const { successRes, errorRes } = require("../utils/response");

// GET /campaigns  — public
async function getAllCampaigns(req, res, next) {
    try {
        const filter = {};
        if (req.query.status) filter.status = req.query.status;
        if (req.query.creator) filter.creator = req.query.creator;
        const campaigns = await campaignService.getAllCampaigns(filter);
        return successRes(res, campaigns);
    } catch (err) { next(err); }
}

// GET /campaigns/:id  — public
async function getCampaignById(req, res, next) {
    try {
        const campaign = await campaignService.getCampaignById(req.params.id);
        if (!campaign) return errorRes(res, "Campaign không tồn tại", 404);
        return successRes(res, campaign);
    } catch (err) { next(err); }
}

// PATCH /campaigns/:id/status  — admin only
async function updateCampaignStatus(req, res, next) {
    try {
        const callerRole = req.headers["x-user-role"];
        if (callerRole !== "admin") return errorRes(res, "Không có quyền truy cập", 403);

        const { status } = req.body;
        const allowed = ["active", "ended", "failed", "cancelled"];
        if (!allowed.includes(status)) {
            return errorRes(res, `Status không hợp lệ. Chấp nhận: ${allowed.join(", ")}`, 400);
        }

        const campaign = await campaignService.updateCampaignStatus(req.params.id, status);
        if (!campaign) return errorRes(res, "Campaign không tồn tại", 404);
        return successRes(res, campaign);
    } catch (err) { next(err); }
}

// PUT /campaigns/:id/metadata  — authenticated (owner hoặc admin)
async function updateCampaignMetadata(req, res, next) {
    try {
        const callerWallet = req.headers["x-wallet-address"];
        const callerRole = req.headers["x-user-role"];

        if (!callerWallet) return errorRes(res, "Yêu cầu đăng nhập", 401);

        const campaign = await campaignService.getCampaignById(req.params.id);
        if (!campaign) return errorRes(res, "Campaign không tồn tại", 404);

        // Chỉ creator hoặc admin mới được sửa metadata
        if (callerRole !== "admin" && campaign.creator !== callerWallet.toLowerCase()) {
            return errorRes(res, "Chỉ người tạo chiến dịch mới có thể sửa thông tin", 403);
        }

        const { title, description, images } = req.body;
        const updates = {};
        if (title !== undefined) updates.title = title;
        if (description !== undefined) updates.description = description;
        if (images !== undefined) updates.images = images;

        const updated = await campaignService.updateMetadata(req.params.id, updates);
        return successRes(res, updated);
    } catch (err) { next(err); }
}

// POST /campaigns  — authenticated
async function createCampaignWithMilestones(req, res, next) {
    try {
        const callerWallet = req.headers["x-wallet-address"];
        if (!callerWallet) return errorRes(res, "Yêu cầu đăng nhập", 401);

        const {
            onChainId,
            title = "Untitled Campaign",
            description = "",
            beneficiary = null,
            goal,
            deadline,
            milestones = [],
        } = req.body || {};

        if (!onChainId || !goal || !deadline) {
            return errorRes(res, "Thiếu trường bắt buộc: onChainId, goal, deadline", 400);
        }

        if (!Array.isArray(milestones)) {
            return errorRes(res, "milestones phải là mảng", 400);
        }

        const created = await campaignService.createCampaignWithMilestones({
            onChainId,
            title,
            description,
            creator: callerWallet,
            beneficiary,
            goal,
            deadline,
            milestones,
        });

        return successRes(res, created, 201);
    } catch (err) {
        if (err.statusCode) return errorRes(res, err.message, err.statusCode);
        return next(err);
    }
}

module.exports = {
    getAllCampaigns,
    getCampaignById,
    updateCampaignStatus,
    updateCampaignMetadata,
    createCampaignWithMilestones,
};
