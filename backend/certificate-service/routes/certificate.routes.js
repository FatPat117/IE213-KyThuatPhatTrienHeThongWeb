const express = require("express");
const { getCertificatesByOwner, getCertificatesByCampaign } = require("../controllers/certificate.controller");
const validateAddress = require("../middlewares/validateAddress");

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Certificates
 *   description: API quản lý chứng nhận quyên góp (NFT)
 */

/**
 * @swagger
 * /owner/{wallet}:
 *   get:
 *     summary: Lấy danh sách chứng nhận của một nhà tài trợ
 *     tags: [Certificates]
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
router.get("/owner/:wallet", validateAddress, getCertificatesByOwner);

/**
 * @swagger
 * /campaign/{id}:
 *   get:
 *     summary: Lấy danh sách chứng nhận đã phát hành cho một chiến dịch
 *     tags: [Certificates]
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
router.get("/campaign/:id", getCertificatesByCampaign);

module.exports = router;
