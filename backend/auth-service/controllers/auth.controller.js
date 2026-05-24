const { ethers } = require("ethers");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const User = require("../models/User.model");
const { successRes, errorRes } = require("../utils/response");

const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret-change-this";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";


async function checkIsAdminOnChain(walletAddress) {
    try {
        const rpcUrl = process.env.SEPOLIA_RPC_URL;
        const contractAddress = process.env.CROWDFUNDING_CONTRACT_ADDRESS;

        if (!rpcUrl || !contractAddress) {
            console.warn("[auth.controller] RPC_URL or CONTRACT_ADDRESS not found in env");
            return false;
        }

        const provider = new ethers.JsonRpcProvider(rpcUrl);
        const contract = new ethers.Contract(
            contractAddress,
            [
                "function hasRole(bytes32 role, address account) public view returns (bool)",
                "function ADMIN_ROLE() public view returns (bytes32)"
            ],
            provider
        );

        // Lấy mã Hash của ADMIN_ROLE trực tiếp từ Contract để đảm bảo luôn đúng
        const adminRoleHash = await contract.ADMIN_ROLE();
        return await contract.hasRole(adminRoleHash, walletAddress);
    } catch (error) {
        console.error("[auth.controller] Error checking admin role on-chain:", error.message);
        return false;
    }
}

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

        // Đồng bộ role admin từ on-chain mỗi lần đăng nhập.
        const isAdmin = await checkIsAdminOnChain(normalizedWallet);
        if (isAdmin && user.role !== "admin") {
            user.role = "admin";
        } else if (!isAdmin && user.role === "admin") {
            // Nếu mất quyền on-chain thì hạ cấp xuống user
            user.role = "user";
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

        // Đồng bộ role admin từ on-chain khi refresh token.
        const normalizedWallet = String(user.walletAddress || "").toLowerCase();
        const isAdmin = await checkIsAdminOnChain(normalizedWallet);
        if (isAdmin && user.role !== "admin") {
            user.role = "admin";
            await user.save();
        } else if (!isAdmin && user.role === "admin") {
            user.role = "user";
            await user.save();
        }

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
