const User = require("../models/User.model");

async function upsertUser(walletAddress, updates = {}) {
    const wallet = walletAddress.toLowerCase();
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

async function updateRole(walletAddress, role) {
    return User.findOneAndUpdate(
        { walletAddress: walletAddress.toLowerCase() },
        { $set: { role } },
        { new: true }
    );
}

module.exports = { upsertUser, getUserByWallet, listUsers, updateRole };
