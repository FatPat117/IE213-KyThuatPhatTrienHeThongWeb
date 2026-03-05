const express = require("express");
const { getUserProfile, upsertUserProfile } = require("../controllers/user.controller");
const validateAddress = require("../middlewares/validateAddress");

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Users
 *   description: API quản lý thông tin hồ sơ người dùng
 */

/**
 * @swagger
 * /{wallet}:
 *   get:
 *     summary: Lấy thông tin hồ sơ người dùng bằng địa chỉ ví
 *     tags: [Users]
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
 *         description: Ví không hợp lệ
 *       404:
 *         description: Không tìm thấy ví
 */
router.get("/:wallet", validateAddress, getUserProfile);

/**
 * @swagger
 * /{wallet}:
 *   put:
 *     summary: Cập nhật hoặc tạo mới thông tin hồ sơ người dùng
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: wallet
 *         schema:
 *           type: string
 *         required: true
 *         description: Địa chỉ ví (0x...)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               displayName:
 *                 type: string
 *                 description: Tên hiển thị
 *               avatarHash:
 *                 type: string
 *                 description: Hash của avatar trên IPFS
 *     responses:
 *       200:
 *         description: Thành công
 *       400:
 *         description: Dữ liệu đầu vào không hợp lệ
 */
router.put("/:wallet", validateAddress, upsertUserProfile);

module.exports = router;
