const express = require("express");
const { getAllCampaigns, getCampaignById } = require("../controllers/campaign.controller");

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Campaigns
 *   description: API quản lý thông tin chiến dịch quyên góp
 */

/**
 * @swagger
 * /:
 *   get:
 *     summary: Lấy danh sách các chiến dịch
 *     tags: [Campaigns]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Lọc theo trạng thái chiến dịch (ví dụ active)
 *     responses:
 *       200:
 *         description: Thành công
 */
router.get("/", getAllCampaigns);

/**
 * @swagger
 * /{id}:
 *   get:
 *     summary: Lấy thông tin chi tiết một chiến dịch
 *     tags: [Campaigns]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID của chiến dịch (onChainId)
 *     responses:
 *       200:
 *         description: Thành công
 *       404:
 *         description: Không tìm thấy chiến dịch
 */
router.get("/:id", getCampaignById);

module.exports = router;
