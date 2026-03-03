const transactionService = require("../services/transaction.service");
const { successRes, errorRes } = require("../utils/response");

// POST /api/transactions  – Frontend gọi ngay khi user ký MetaMask
async function createTransaction(req, res, next) {
    try {
        const { txHash, walletAddress, action, campaignOnChainId } = req.body;
        if (!txHash || !walletAddress || !action) {
            return errorRes(res, "txHash, walletAddress, action là bắt buộc", 400);
        }
        const tx = await transactionService.createTransaction({ txHash, walletAddress, action, campaignOnChainId });
        return successRes(res, tx, 201);
    } catch (err) { next(err); }
}

// PATCH /api/transactions/:txHash/status  – listener-service gọi sau khi blockchain confirm
async function updateStatus(req, res, next) {
    try {
        const { status, errorMessage } = req.body;
        if (!status) return errorRes(res, "status là bắt buộc", 400);
        const tx = await transactionService.updateTransactionStatus(
            req.params.txHash, status, errorMessage
        );
        if (!tx) return errorRes(res, "Transaction không tồn tại", 404);
        return successRes(res, tx);
    } catch (err) { next(err); }
}

// GET /api/transactions/:wallet  – lịch sử giao dịch của 1 ví
async function getByWallet(req, res, next) {
    try {
        const txs = await transactionService.getTransactionsByWallet(req.params.wallet);
        return successRes(res, txs);
    } catch (err) { next(err); }
}

module.exports = { createTransaction, updateStatus, getByWallet };
