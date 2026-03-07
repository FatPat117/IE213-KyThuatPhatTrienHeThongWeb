const express = require("express");
const {
    getAllCampaigns,
    getCampaignById,
    updateCampaignStatus,
    updateCampaignMetadata,
} = require("../controllers/campaign.controller");

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

module.exports = router;
