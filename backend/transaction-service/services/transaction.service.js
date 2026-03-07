const Transaction = require("../models/Transaction.model");

async function createTransaction(data) {
    const { txHash, walletAddress, action, campaignOnChainId } = data;
    if (!txHash || !walletAddress || !action) {
        throw Object.assign(new Error("txHash, walletAddress, action là bắt buộc"), { statusCode: 400 });
    }
    // Idempotent: nếu txHash đã tồn tại thì trả về record cũ
    const existing = await Transaction.findOne({ txHash });
    if (existing) return existing;

    return Transaction.create({ txHash, walletAddress, action, campaignOnChainId, status: "pending" });
}

async function updateTransactionStatus(txHash, status, errorMessage = "") {
    if (!["pending", "success", "failed"].includes(status)) {
        throw Object.assign(new Error("status phải là pending|success|failed"), { statusCode: 400 });
    }
    const update = { status };
    if (status === "failed" && errorMessage) update.errorMessage = errorMessage;

    return Transaction.findOneAndUpdate(
        { txHash },
        { $set: update },
        { new: true }
    );
}

async function getTransactionsByWallet(walletAddress) {
    return Transaction.find({ walletAddress: walletAddress.toLowerCase() })
        .sort({ createdAt: -1 });
}

async function getTransactionByHash(txHash) {
    return Transaction.findOne({ txHash: txHash.toLowerCase() });
}

module.exports = {
    createTransaction,
    updateTransactionStatus,
    getTransactionsByWallet,
    getTransactionByHash,
};
