const transactionService = require("../services/transaction.service");
const { successRes, errorRes } = require("../utils/response");

// POST /api/transactions - Frontend calls this right after the wallet signature.
async function createTransaction(req, res, next) {
    try {
        const { txHash, walletAddress, action, campaignOnChainId } = req.body;
        if (!txHash || !walletAddress || !action) {
            return errorRes(
                res,
                "txHash, walletAddress, and action are required",
                400,
            );
        }
        const tx = await transactionService.createTransaction({
            txHash,
            walletAddress,
            action,
            campaignOnChainId,
        });
        return successRes(res, tx, 201);
    } catch (err) {
        next(err);
    }
}

// PATCH /api/transactions/:txHash/status - listener-service calls this after blockchain confirmation.
async function updateStatus(req, res, next) {
    try {
        const { status, errorMessage, txContext } = req.body;
        if (!status) return errorRes(res, "status is required", 400);
        const tx = await transactionService.updateTransactionStatus(
            req.params.txHash,
            status,
            errorMessage,
            txContext,
        );
        if (!tx) return errorRes(res, "Transaction does not exist", 404);
        return successRes(res, tx);
    } catch (err) {
        next(err);
    }
}

// GET /api/transactions/:wallet - transaction history for one wallet.
async function getByWallet(req, res, next) {
    try {
        const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
        const limit = Math.min(
            Math.max(Number.parseInt(req.query.limit, 10) || 20, 1),
            100,
        );

        const paginatedResult =
            await transactionService.getTransactionsByWallet(
                req.params.wallet,
                { page, limit },
            );

        return successRes(res, {
            items: paginatedResult.items,
            totalItems: paginatedResult.totalItems,
            totalPages: paginatedResult.totalPages,
            currentPage: paginatedResult.currentPage,
        });
    } catch (err) {
        next(err);
    }
}

module.exports = { createTransaction, updateStatus, getByWallet };
