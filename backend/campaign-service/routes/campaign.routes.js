const express = require("express");
const {
    createCampaignWithMilestones,
    getAllCampaigns,
    getCampaignById,
    updateCampaignStatus,
    updateCampaignMetadata,
} = require("../controllers/campaign.controller");
const {
    getCampaignRefundInfo,
    prepareCampaignRefund,
} = require("../controllers/milestone.controller");

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Campaigns
 *   description: API quản lý chiến dịch quyên góp
 */

// ── Public routes ────────────────────────────────────────────

/**
 * @swagger
 * /:
 *   get:
 *     summary: Lấy danh sách chiến dịch
 *     tags: [Campaigns]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *       - in: query
 *         name: creator
 *         schema: { type: string }
 *     responses:
 *       200: { description: Thành công }
 */
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

/**
 * @swagger
 * /{id}:
 *   get:
 *     summary: Lấy chi tiết một chiến dịch
 *     tags: [Campaigns]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Thành công }
 *       404: { description: Không tìm thấy }
 */
router.get("/:id", getCampaignById);

// ── Authenticated routes ──────────────────────────────────────

/**
 * @swagger
 * /{id}/metadata:
 *   put:
 *     summary: Cập nhật metadata off-chain (creator hoặc admin)
 *     tags: [Campaigns]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               description: { type: string }
 *               images:
 *                 type: array
 *                 items: { type: string }
 *     responses:
 *       200: { description: Thành công }
 *       403: { description: Không có quyền }
 */
router.put("/:id/metadata", updateCampaignMetadata);

// ── Admin routes ──────────────────────────────────────────────

/**
 * @swagger
 * /{id}/status:
 *   patch:
 *     summary: "[Admin] Cập nhật trạng thái chiến dịch"
 *     tags: [Campaigns]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [active, ended, failed, cancelled]
 *     responses:
 *       200: { description: Thành công }
 *       403: { description: Không có quyền }
 */
router.patch("/:id/status", updateCampaignStatus);

/**
 * @swagger
 * /{id}/refund-info:
 *   get:
 *     summary: Kiểm tra khả năng hoàn tiền toàn campaign cho donor
 *     tags: [Campaigns]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Thành công }
 *       403: { description: Không có quyền }
 */
router.get("/:id/refund-info", getCampaignRefundInfo);

/**
 * @swagger
 * /{id}/refund/prepare:
 *   post:
 *     summary: Chuẩn bị payload hoàn tiền toàn campaign (compat mode)
 *     tags: [Campaigns]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Thành công }
 *       409: { description: Không đủ điều kiện hoàn tiền }
 */
router.post("/:id/refund/prepare", prepareCampaignRefund);

module.exports = router;
