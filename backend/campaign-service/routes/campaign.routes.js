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
    getRefundStatus,
} = require("../controllers/campaign.controller");
const {
    getReviewerProfile,
    patchReviewerProfile,
    listReviewerProfilesForAdmin,
    patchReviewerProfileForAdmin,
    clearReviewerProfileForAdmin,
} = require("../controllers/reviewerProfile.controller");

const router = express.Router();

router.get("/reviewers/profile", requireAuth, getReviewerProfile);
router.patch("/reviewers/profile", requireAuth, patchReviewerProfile);
router.get(
    "/reviewers/admin/profiles",
    requireAuth,
    listReviewerProfilesForAdmin,
);
router.patch(
    "/reviewers/admin/profiles/:walletAddress",
    requireAuth,
    patchReviewerProfileForAdmin,
);
router.delete(
    "/reviewers/admin/profiles/:walletAddress",
    requireAuth,
    clearReviewerProfileForAdmin,
);

router.get("/public/stats", publicRateLimit, getPublicStats);
router.get("/public/campaigns", publicRateLimit, getPublicCampaigns);
router.get(
    "/public/campaigns/:onChainId/milestones",
    publicRateLimit,
    getPublicCampaignMilestones,
);
router.get(
    "/public/campaigns/:onChainId/refund-status",
    publicRateLimit,
    getRefundStatus,
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

router.get("/", getAllCampaigns);
router.post("/", requireAuth, (_req, res) => {
    return res.status(410).json({
        success: false,
        message:
            "Legacy campaign creation endpoint is disabled. Create campaigns on-chain and rely on campaign.created events.",
    });
});

router.get("/:onChainId", getCampaignById);
router.patch("/:onChainId/status", requireAuth, updateCampaignStatus);

module.exports = router;
