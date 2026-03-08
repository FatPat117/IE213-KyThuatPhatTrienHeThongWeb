const User = require("../models/user.model");

async function upsertUser(walletAddress, updates = {}) {
    const wallet = walletAddress.toLowerCase();

    // Tự động thăng cấp Admin nếu ví khớp với cấu hình INITIAL_ADMIN_WALLET
    if (process.env.INITIAL_ADMIN_WALLET && 
        wallet === process.env.INITIAL_ADMIN_WALLET.toLowerCase()) {
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

    // Bảo vệ: Không cho phép hạ cấp Root Admin (định nghĩa trong ENV)
    if (process.env.INITIAL_ADMIN_WALLET && 
        wallet === process.env.INITIAL_ADMIN_WALLET.toLowerCase() && 
        role !== "admin") {
        throw Object.assign(new Error("Không thể hạ cấp Root Admin cấp cao nhất"), { statusCode: 403 });
    }

    return User.findOneAndUpdate(
        { walletAddress: wallet },
        { $set: { role } },
        { new: true }
    );
}

module.exports = { upsertUser, getUserByWallet, listUsers, listAdmins, updateRole };
