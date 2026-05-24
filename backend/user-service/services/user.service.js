const User = require("../models/user.model");

async function upsertUser(walletAddress, updates = {}) {
    const wallet = walletAddress.toLowerCase();

    // Admin role is now primarily handled by auth-service on-chain check.
    // We don't need to auto-promote here anymore, but keeping it for backward compatibility if needed via ADMIN_WALLETS.
    const adminList = (process.env.ADMIN_WALLETS || "").toLowerCase().split(",");
    if (adminList.includes(wallet)) {
        updates.role = "admin";
    }

    return User.findOneAndUpdate(
        { walletAddress: wallet },
        { $set: { walletAddress: wallet, ...updates } },
        { upsert: true, new: true, runValidators: true }
    );
}

async function getUserByWallet(walletAddress) {
    return User.findOne({ walletAddress: walletAddress.toLowerCase() });
}

async function listUsers(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [users, total] = await Promise.all([
        User.find({}, "-nonce").sort({ createdAt: -1 }).skip(skip).limit(limit),
        User.countDocuments(),
    ]);
    return { users, total, page, limit };
}

async function listAdmins() {
    return User.find({ role: "admin" }, "-nonce").sort({ createdAt: -1 });
}

async function updateRole(walletAddress, role) {
    const wallet = walletAddress.toLowerCase();

    // Bảo vệ: Không cho phép hạ cấp Admin cấp cao nhất (định nghĩa trong ENV)
    const adminList = (process.env.ADMIN_WALLETS || "").toLowerCase().split(",");
    if (adminList.includes(wallet) && role !== "admin") {
        throw Object.assign(new Error("Không thể hạ cấp Admin cấp cao nhất"), { statusCode: 403 });
    }

    return User.findOneAndUpdate(
        { walletAddress: wallet },
        { $set: { role } },
        { new: true }
    );
}

module.exports = { upsertUser, getUserByWallet, listUsers, listAdmins, updateRole };
