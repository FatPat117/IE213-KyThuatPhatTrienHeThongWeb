const Transaction = require("../models/transaction.model");

function toNumberOrNull(value) {
    if (value === undefined || value === null || value === "") return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function normalizeTxContext(txContext = {}) {
    return {
        chainId: toNumberOrNull(txContext.chainId),
        blockNumber: toNumberOrNull(txContext.blockNumber),
        blockTimestamp: txContext.blockTimestamp
            ? new Date(txContext.blockTimestamp)
            : null,
        transactionIndex: toNumberOrNull(txContext.transactionIndex),
        logIndex: toNumberOrNull(txContext.logIndex),
        nonce: toNumberOrNull(txContext.nonce),
        fromAddress: txContext.fromAddress
            ? String(txContext.fromAddress).toLowerCase()
            : null,
        toAddress: txContext.toAddress
            ? String(txContext.toAddress).toLowerCase()
            : null,
        gasUsed:
            txContext.gasUsed !== undefined && txContext.gasUsed !== null
                ? String(txContext.gasUsed)
                : null,
        effectiveGasPrice:
            txContext.effectiveGasPrice !== undefined &&
            txContext.effectiveGasPrice !== null
                ? String(txContext.effectiveGasPrice)
                : null,
        gasFeeWei:
            txContext.gasFeeWei !== undefined && txContext.gasFeeWei !== null
                ? String(txContext.gasFeeWei)
                : null,
        txType: toNumberOrNull(txContext.txType),
    };
}

async function createTransaction(data) {
    const { txHash, walletAddress, action, campaignOnChainId } = data;
    if (!txHash || !walletAddress || !action) {
        throw Object.assign(
            new Error("txHash, walletAddress, and action are required"),
            { statusCode: 400 },
        );
    }
    // Idempotent behavior: if txHash already exists, return the existing record.
    const existing = await Transaction.findOne({ txHash });
    if (existing) return existing;

    return Transaction.create({
        txHash,
        walletAddress,
        action,
        campaignOnChainId,
        status: "pending",
    });
}

async function updateTransactionStatus(
    txHash,
    status,
    errorMessage = "",
    txContext = {},
) {
    if (!["pending", "success", "failed"].includes(status)) {
        throw Object.assign(
            new Error("status must be one of: pending, success, failed"),
            { statusCode: 400 },
        );
    }
    const normalizedTxContext = normalizeTxContext(txContext);
    const update = {
        status,
        ...normalizedTxContext,
        lastSyncedAt: new Date(),
    };
    if (status === "failed" && errorMessage) update.errorMessage = errorMessage;

    return Transaction.findOneAndUpdate(
        { txHash: txHash.toLowerCase() },
        { $set: update },
        { new: true },
    );
}

async function getTransactionsByWallet(walletAddress, options = {}) {
    const page = Math.max(Number(options.page) || 1, 1);
    const limit = Math.min(Math.max(Number(options.limit) || 20, 1), 100);
    const skip = (page - 1) * limit;
    const filter = { walletAddress: walletAddress.toLowerCase() };

    const [totalItems, items] = await Promise.all([
        Transaction.countDocuments(filter),
        Transaction.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit),
    ]);

    return {
        items,
        totalItems,
        totalPages: totalItems > 0 ? Math.ceil(totalItems / limit) : 0,
        currentPage: page,
    };
}

async function getTransactionByHash(txHash) {
    return Transaction.findOne({ txHash: txHash.toLowerCase() });
}

module.exports = {
    createTransaction,
    updateTransactionStatus,
    getTransactionsByWallet,
    getTransactionByHash,
    normalizeTxContext,
};
