const express = require("express");
const requireAuth = require("../middlewares/requireAuth");
const publicRateLimit = require("../middlewares/publicRateLimit");
const {
    createCampaignWithMilestones,
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

/**
 * @swagger
 * /:
 *   post:
 *     summary: Tạo campaign kèm milestones (off-chain)
 *     tags: [Campaigns]
 *     security:
 *       - ApiKeyHeaderAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [onChainId, goal, deadline]
 *             properties:
 *               onChainId: { type: number, example: 1001 }
 *               title: { type: string, example: "Chien dich ho tro mien Trung" }
 *               description: { type: string }
 *               beneficiary: { type: string, example: "0x2222222222222222222222222222222222222222" }
 *               goal: { type: string, example: "10000000000000000000" }
 *               deadline: { type: string, format: date-time, example: "2027-01-01T00:00:00.000Z" }
 *               milestones:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     milestoneIndex: { type: number, example: 1 }
 *                     title: { type: string, example: "Moc 1" }
 *                     description: { type: string }
 *                     financialTargetWei: { type: string, example: "5000000000000000000" }
 *                     deadline: { type: string, format: date-time }
 *     responses:
 *       201: { description: Tạo campaign thành công }
 *       400: { description: Dữ liệu đầu vào không hợp lệ }
 *       401: { description: Chưa đăng nhập }
 *       409: { description: Campaign đã tồn tại }
 */
router.post("/", createCampaignWithMilestones);
router.get("/:onChainId", getCampaignById);
router.patch("/:onChainId/status", requireAuth, updateCampaignStatus);

module.exports = router;
