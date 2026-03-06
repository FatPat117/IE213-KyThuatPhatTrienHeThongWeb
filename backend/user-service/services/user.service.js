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

module.exports = { upsertUser, getUserByWallet };
