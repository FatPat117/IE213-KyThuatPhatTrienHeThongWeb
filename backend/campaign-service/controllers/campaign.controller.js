const campaignService = require("../services/campaign.service");
const { successRes, errorRes } = require("../utils/response");

/**
 * GET /campaigns
 * Query: ?status=active|ended|failed  ?creator=0x...
 */
async function getAllCampaigns(req, res, next) {
    try {
        const filter = {};
        if (req.query.status) filter.status = req.query.status;
        if (req.query.creator) filter.creator = req.query.creator;
        const campaigns = await campaignService.getAllCampaigns(filter);
        return successRes(res, campaigns);
    } catch (err) {
        next(err);
    }
}

/**
 * GET /campaigns/:id
 * :id = onChainId
 */
async function getCampaignById(req, res, next) {
    try {
        const campaign = await campaignService.getCampaignById(req.params.id);
        if (!campaign) return errorRes(res, "Campaign không tồn tại", 404);
        return successRes(res, campaign);
    } catch (err) {
        next(err);
    }
}

module.exports = { getAllCampaigns, getCampaignById };
