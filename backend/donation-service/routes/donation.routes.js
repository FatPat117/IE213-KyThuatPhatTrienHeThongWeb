const express = require("express");
const { getDonationsByCampaign, getDonationsByDonor } = require("../controllers/donation.controller");
const validateAddress = require("../middlewares/validateAddress");

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Donations
 *   description: API quản lý thông tin quyên góp
 */

/**
 * @swagger
 * /campaign/{id}:
 *   get:
 *     summary: Lấy danh sách quyên góp của một chiến dịch
 *     tags: [Donations]
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
 *         description: Không tìm thấy
 */
router.get("/campaign/:id", getDonationsByCampaign);

/**
 * @swagger
 * /donor/{wallet}:
 *   get:
 *     summary: Lấy danh sách quyên góp của một nhà tài trợ (dựa trên địa chỉ ví)
 *     tags: [Donations]
 *     parameters:
 *       - in: path
 *         name: wallet
 *         schema:
 *           type: string
 *         required: true
 *         description: Địa chỉ ví của nhà tài trợ (0x...)
 *     responses:
 *       200:
 *         description: Thành công
 *       400:
 *         description: Địa chỉ ví không hợp lệ
 */
router.get("/donor/:wallet", validateAddress, getDonationsByDonor);

module.exports = router;
