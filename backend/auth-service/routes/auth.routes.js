const express = require("express");
const { getNonce, verifySignature, refreshToken } = require("../controllers/auth.controller");

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Xác thực bằng Metamask (SIWE - Sign-In with Ethereum)
 */

/**
 * @swagger
 * /nonce:
 *   post:
 *     summary: Lấy nonce để ký bằng Metamask
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [wallet]
 *             properties:
 *               wallet:
 *                 type: string
 *                 description: Địa chỉ ví Ethereum (0x...)
 *     responses:
 *       200:
 *         description: Trả về nonce để frontend ký
 *       400:
 *         description: Địa chỉ ví không hợp lệ
 */
router.post("/nonce", getNonce);

/**
 * @swagger
 * /verify:
 *   post:
 *     summary: Xác thực chữ ký Metamask và cấp JWT
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [wallet, signature]
 *             properties:
 *               wallet:
 *                 type: string
 *               signature:
 *                 type: string
 *                 description: Kết quả của signer.signMessage(nonce)
 *     responses:
 *       200:
 *         description: Thành công, trả về JWT token
 *       401:
 *         description: Signature không hợp lệ
 */
router.post("/verify", verifySignature);

/**
 * @swagger
 * /refresh:
 *   post:
 *     summary: Làm mới JWT token
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Trả về token mới
 *       401:
 *         description: Token không hợp lệ
 */
router.post("/refresh", refreshToken);

module.exports = router;
