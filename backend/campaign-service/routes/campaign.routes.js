const express = require("express");
const requireAuth = require("../middlewares/requireAuth");
const publicRateLimit = require("../middlewares/publicRateLimit");
const {
    getAllCampaigns,
    getCampaignById,
    updateCampaignStatus,
    updateCampaignMetadata,
    getCampaignIndexStatus,
    getPublicStats,
    getPublicCampaigns,
    getPublicCampaignByOnChainId,
    getPublicCampaignMilestones,
    getMilestoneApprovalStatus,
} = require("../controllers/campaign.controller");

const router = express.Router();

router.get("/public/stats", publicRateLimit, getPublicStats);
router.get("/public/campaigns", publicRateLimit, getPublicCampaigns);
router.get(
    "/public/campaigns/:onChainId/milestones",
    publicRateLimit,
    getPublicCampaignMilestones,
);
router.get(
    "/public/campaigns/:onChainId",
    publicRateLimit,
    getPublicCampaignByOnChainId,
);

router.get("/:onChainId/status", getCampaignIndexStatus);

router.put("/:onChainId/metadata", requireAuth, updateCampaignMetadata);
router.get(
    "/:onChainId/milestones/:milestoneId/approval-status",
    requireAuth,
    getMilestoneApprovalStatus,
);

// Legacy endpoints kept for backward compatibility.
router.get("/", getAllCampaigns);
router.get("/:onChainId", getCampaignById);
router.patch("/:onChainId/status", requireAuth, updateCampaignStatus);

module.exports = router;
