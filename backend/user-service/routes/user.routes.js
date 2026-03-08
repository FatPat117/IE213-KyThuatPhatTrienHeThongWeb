const express = require("express");
const {
    getUserProfile,
    upsertUserProfile,
    listAllUsers,
    updateUserRole,
} = require("../controllers/user.controller");
const validateAddress = require("../middlewares/validateAddress");

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Users
 *   description: API quản lý thông tin hồ sơ người dùng
 */

// ── Public routes ────────────────────────────────────────────

/**
 * @swagger
 * /{wallet}:
 *   get:
 *     summary: Lấy thông tin hồ sơ người dùng
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: wallet
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Thành công }
 *       404: { description: Không tìm thấy }
 */
router.get("/:wallet", validateAddress, getUserProfile);

// ── Authenticated routes (ownership check in controller) ─────

/**
 * @swagger
 * /{wallet}:
 *   put:
 *     summary: Cập nhật hồ sơ (chỉ wallet của mình hoặc admin)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: wallet
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               displayName: { type: string }
 *               avatarUrl: { type: string }
 *     responses:
 *       200: { description: Thành công }
 *       403: { description: Không có quyền }
 */
router.put("/:wallet", validateAddress, upsertUserProfile);

// ── Admin routes ─────────────────────────────────────────────

/**
 * @swagger
 * /admin/list:
 *   get:
 *     summary: "[Admin] Danh sách tất cả người dùng"
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200: { description: Thành công }
 *       403: { description: Không có quyền }
 */
router.get("/admin/list", listAllUsers);

/**
 * @swagger
 * /admin/list-admins:
 *   get:
 *     summary: "[Admin] Danh sách tất cả quản trị viên"
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Thành công }
 *       403: { description: Không có quyền }
 */
router.get("/admin/list-admins", listAdmins);

/**
 * @swagger
 * /admin/{wallet}/role:
 *   patch:
 *     summary: "[Admin] Cập nhật role người dùng"
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: wallet
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [role]
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [user, admin]
 *     responses:
 *       200: { description: Thành công }
 *       403: { description: Không có quyền }
 */
router.patch("/admin/:wallet/role", validateAddress, updateUserRole);

module.exports = router;
