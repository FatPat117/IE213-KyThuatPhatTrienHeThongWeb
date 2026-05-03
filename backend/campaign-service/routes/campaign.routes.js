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
    getReviewerProfiles,
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

/**
 * @swagger
 * /api/campaigns/reviewers:
 *   get:
 *     summary: Lấy danh sách reviewer profile
 *     description: Trả về toàn bộ reviewer profile đã lưu trong campaign-service.
 *     tags: [Campaigns]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       reviewerCode:
 *                         type: string
 *                         example: REVIEWER_001
 *                       walletAddress:
 *                         type: string
 *                         example: 0x1234567890abcdef1234567890abcdef12345678
 *                       isActive:
 *                         type: boolean
 *                         example: true
 *                       organizationName:
 *                         type: string
 *                         example: Sở Y tế TP.HCM
 *                       region:
 *                         type: string
 *                         example: TP.HCM
 *                       walletHistory:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             oldWallet:
 *                               type: string
 *                             newWallet:
 *                               type: string
 *                             changedAt:
 *                               type: string
 *                               format: date-time
 *                               nullable: true
 *                             changedBy:
 *                               type: string
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                         nullable: true
 *                       updatedAt:
 *                         type: string
 *                         format: date-time
 *                         nullable: true
 *       401:
 *         description: Chưa xác thực
 *       500:
 *         description: Lỗi server
 */
router.get("/reviewers", requireAuth, getReviewerProfiles);

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
