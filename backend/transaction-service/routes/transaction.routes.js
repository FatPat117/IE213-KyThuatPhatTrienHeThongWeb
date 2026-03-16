const express = require("express");
const {
    createTransaction,
    updateStatus,
    getByWallet,
    getByCampaign,
} = require("../controllers/transaction.controller");
const validateAddress = require("../middlewares/validateAddress");

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Transactions
 *   description: API quản lý trạng thái giao dịch
 */

/**
 * @swagger
 * /:
 *   post:
 *     summary: Tạo mới một giao dịch ở trạng thái pending
 *     tags: [Transactions]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               txHash:
 *                 type: string
 *               wallet:
 *                 type: string
 *               amount:
 *                 type: number
 *     responses:
 *       201:
 *         description: Đã tạo giao dịch
 *       400:
 *         description: Dữ liệu không hợp lệ
 */
router.post("/", createTransaction);

/**
 * @swagger
 * /{txHash}/status:
 *   patch:
 *     summary: Cập nhật trạng thái giao dịch (thường do listener gọi)
 *     tags: [Transactions]
 *     parameters:
 *       - in: path
 *         name: txHash
 *         schema:
 *           type: string
 *         required: true
 *         description: Hash của giao dịch
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 *       404:
 *         description: Không tìm thấy giao dịch
 */
router.patch("/:txHash/status", updateStatus);

/**
 * @swagger
 * /campaign/{id}:
 *   get:
 *     summary: Lấy lịch sử giao dịch của một chiến dịch
 *     tags: [Transactions]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: onChainId của campaign
 *     responses:
 *       200:
 *         description: Thành công
 *       400:
 *         description: campaign id không hợp lệ
 */
router.get("/campaign/:id", getByCampaign);

/**
 * @swagger
 * /{wallet}:
 *   get:
 *     summary: Lấy lịch sử giao dịch của một ví
 *     tags: [Transactions]
 *     parameters:
 *       - in: path
 *         name: wallet
 *         schema:
 *           type: string
 *         required: true
 *         description: Địa chỉ ví (0x...)
 *     responses:
 *       200:
 *         description: Thành công
 *       400:
 *         description: Địa chỉ ví không hợp lệ
 */
router.get("/:wallet", validateAddress, getByWallet);

module.exports = router;
