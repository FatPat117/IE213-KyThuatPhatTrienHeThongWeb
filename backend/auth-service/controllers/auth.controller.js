const { ethers } = require("ethers");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const User = require("../models/User.model");
const { successRes, errorRes } = require("../utils/response");

const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret-change-this";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

/**
 * POST /api/auth/nonce
 * Body: { wallet: "0x..." }
 * Trả về nonce ngẫu nhiên để frontend ký bằng Metamask.
 */
async function getNonce(req, res, next) {
    try {
        const wallet = req.body.wallet?.toLowerCase();
        if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
            return errorRes(res, "Địa chỉ ví không hợp lệ", 400);
        }

        const nonce = uuidv4();

        // Upsert user – tạo mới nếu chưa có, cập nhật nonce
        await User.findOneAndUpdate(
            { walletAddress: wallet },
            { $set: { walletAddress: wallet, nonce } },
            { upsert: true, new: true, runValidators: true }
        );

        return successRes(res, { nonce, wallet });
    } catch (err) {
        next(err);
    }
}

/**
 * POST /api/auth/verify
 * Body: { wallet: "0x...", signature: "0x..." }
 * Verify chữ ký Metamask (personal_sign) → cấp JWT.
 *
 * Frontend ký bằng: await signer.signMessage(nonce)
 */
async function verifySignature(req, res, next) {
    try {
        const { wallet, signature } = req.body;

        if (!wallet || !signature) {
            return errorRes(res, "Thiếu wallet hoặc signature", 400);
        }

        const normalizedWallet = wallet.toLowerCase();

        // Tìm user và lấy nonce
        const user = await User.findOne({ walletAddress: normalizedWallet });
        if (!user || !user.nonce) {
            return errorRes(res, "Nonce không tồn tại. Vui lòng gọi /nonce trước.", 401);
        }

        // Recover địa chỉ từ signature
        let recoveredAddress;
        try {
            recoveredAddress = ethers.verifyMessage(user.nonce, signature).toLowerCase();
        } catch {
            return errorRes(res, "Signature không hợp lệ", 401);
        }

        if (recoveredAddress !== normalizedWallet) {
            return errorRes(res, "Signature không khớp với địa chỉ ví", 401);
        }

        // Xoá nonce sau khi đã dùng (one-time use)
        user.nonce = "";
        await user.save();

        // Tạo JWT
        const token = jwt.sign(
            {
                wallet: user.walletAddress,
                role: user.role,
            },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );

        return successRes(res, {
            token,
            user: {
                wallet: user.walletAddress,
                role: user.role,
                displayName: user.displayName,
            },
        });
    } catch (err) {
        next(err);
    }
}

/**
 * POST /api/auth/refresh
 * Header: Authorization: Bearer <token>
 * Làm mới JWT nếu token còn hạn.
 */
async function refreshToken(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader?.split(" ")[1];
        if (!token) return errorRes(res, "Không có token", 401);

        let decoded;
        try {
            decoded = jwt.verify(token, JWT_SECRET);
        } catch {
            return errorRes(res, "Token không hợp lệ hoặc đã hết hạn", 401);
        }

        // Lấy thông tin mới nhất từ DB (phòng role bị thay đổi)
        const user = await User.findOne({ walletAddress: decoded.wallet });
        if (!user) return errorRes(res, "User không tồn tại", 404);

        const newToken = jwt.sign(
            { wallet: user.walletAddress, role: user.role },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );

        return successRes(res, {
            token: newToken,
            user: {
                wallet: user.walletAddress,
                role: user.role,
                displayName: user.displayName,
            },
        });
    } catch (err) {
        next(err);
    }
}

module.exports = { getNonce, verifySignature, refreshToken };
