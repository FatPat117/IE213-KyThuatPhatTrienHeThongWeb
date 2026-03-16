const Transaction = require("../models/transaction.model");

const CAMPAIGN_SERVICE_URL =
    process.env.CAMPAIGN_SERVICE_URL || "http://campaign-service:4002";

const CAMPAIGN_TITLE_CACHE = new Map();
const CAMPAIGN_TITLE_CACHE_TTL_MS = 60_000;

async function fetchCampaignTitle(campaignOnChainId) {
    const normalizedId = Number(campaignOnChainId);
    if (!Number.isFinite(normalizedId)) return "";

    const cached = CAMPAIGN_TITLE_CACHE.get(normalizedId);
    if (cached && Date.now() - cached.cachedAt < CAMPAIGN_TITLE_CACHE_TTL_MS) {
        return cached.title;
    }

    try {
        const response = await fetch(
            `${CAMPAIGN_SERVICE_URL}/api/campaigns/${normalizedId}`,
        );
        if (!response.ok) {
            return "";
        }

        const payload = await response.json();
        const title = payload?.data?.title || "";

        if (title) {
            CAMPAIGN_TITLE_CACHE.set(normalizedId, {
                title,
                cachedAt: Date.now(),
            });
        }

        return title;
    } catch {
        return "";
    }
}

async function attachCampaignTitles(transactions) {
    if (!Array.isArray(transactions) || transactions.length === 0) {
        return transactions;
    }

    const missingTitleCampaignIds = Array.from(
        new Set(
            transactions
                .filter(
                    (tx) =>
                        tx.campaignOnChainId !== null &&
                        tx.campaignOnChainId !== undefined &&
                        !tx.campaignTitle,
                )
                .map((tx) => Number(tx.campaignOnChainId))
                .filter((id) => Number.isFinite(id)),
        ),
    );

    await Promise.all(
        missingTitleCampaignIds.map(async (campaignOnChainId) => {
            const title = await fetchCampaignTitle(campaignOnChainId);
            if (!title) return;

            await Transaction.updateMany(
                {
                    campaignOnChainId,
                    $or: [
                        { campaignTitle: "" },
                        { campaignTitle: { $exists: false } },
                    ],
                },
                { $set: { campaignTitle: title } },
            );
        }),
    );

    return transactions.map((tx) => {
        if (tx.campaignTitle) return tx;
        if (tx.campaignOnChainId === null || tx.campaignOnChainId === undefined)
            return tx;

        const cached = CAMPAIGN_TITLE_CACHE.get(Number(tx.campaignOnChainId));
        if (!cached?.title) return tx;

        const transactionObject = tx.toObject ? tx.toObject() : { ...tx };
        return {
            ...transactionObject,
            campaignTitle: cached.title,
        };
    });
}

async function createTransaction(data) {
    const { txHash, walletAddress, action, campaignOnChainId, campaignTitle } =
        data;
    if (!txHash || !walletAddress || !action) {
        throw Object.assign(
            new Error("txHash, walletAddress, action là bắt buộc"),
            { statusCode: 400 },
        );
    }
    // Idempotent: nếu txHash đã tồn tại thì trả về record cũ
    const existing = await Transaction.findOne({ txHash });
    if (existing) return existing;

    const normalizedCampaignId =
        campaignOnChainId === undefined || campaignOnChainId === null
            ? null
            : Number(campaignOnChainId);

    const derivedCampaignTitle =
        (typeof campaignTitle === "string" ? campaignTitle.trim() : "") ||
        (normalizedCampaignId
            ? await fetchCampaignTitle(normalizedCampaignId)
            : "");

    return Transaction.create({
        txHash,
        walletAddress,
        action,
        campaignOnChainId: normalizedCampaignId,
        campaignTitle: derivedCampaignTitle,
        status: "pending",
    });
}

async function updateTransactionStatus(txHash, status, errorMessage = "") {
    if (!["pending", "success", "failed"].includes(status)) {
        throw Object.assign(
            new Error("status phải là pending|success|failed"),
            { statusCode: 400 },
        );
    }
    const update = { status };
    if (status === "failed" && errorMessage) update.errorMessage = errorMessage;

    return Transaction.findOneAndUpdate(
        { txHash },
        { $set: update },
        { new: true },
    );
}

async function getTransactionsByWallet(walletAddress) {
    const transactions = await Transaction.find({
        walletAddress: walletAddress.toLowerCase(),
    }).sort({ createdAt: -1 });

    return attachCampaignTitles(transactions);
}

async function getTransactionsByCampaign(campaignOnChainId) {
    const normalizedCampaignId = Number(campaignOnChainId);
    if (!Number.isFinite(normalizedCampaignId)) {
        throw Object.assign(new Error("campaignOnChainId không hợp lệ"), {
            statusCode: 400,
        });
    }

    const transactions = await Transaction.find({
        campaignOnChainId: normalizedCampaignId,
    }).sort({ createdAt: -1 });

    return attachCampaignTitles(transactions);
}

async function getTransactionByHash(txHash) {
    return Transaction.findOne({ txHash: txHash.toLowerCase() });
}

/**
 * Upsert transaction với status success – dùng bởi listener-service cho các action
 * mà frontend không tạo pending trước (withdrawFunds, cancelCampaign, claimRefund, markAsFailed).
 * - Nếu txHash đã tồn tại với status pending → update thành success.
 * - Nếu chưa tồn tại → tạo mới trực tiếp với status success.
 */
async function upsertTransactionSuccess({
    txHash,
    walletAddress,
    action,
    campaignOnChainId,
    campaignTitle,
}) {
    const normalizedHash = txHash.toLowerCase();
    const existing = await Transaction.findOne({ txHash: normalizedHash });

    if (existing) {
        if (existing.status === "pending") {
            return Transaction.findOneAndUpdate(
                { txHash: normalizedHash },
                { $set: { status: "success" } },
                { new: true },
            );
        }
        return existing;
    }

    const normalizedCampaignId =
        campaignOnChainId != null ? Number(campaignOnChainId) : null;
    const resolvedTitle =
        (typeof campaignTitle === "string" ? campaignTitle.trim() : "") ||
        (normalizedCampaignId
            ? await fetchCampaignTitle(normalizedCampaignId)
            : "");

    return Transaction.create({
        txHash: normalizedHash,
        walletAddress: walletAddress.toLowerCase(),
        action,
        campaignOnChainId: normalizedCampaignId,
        campaignTitle: resolvedTitle,
        status: "success",
    });
}

module.exports = {
    createTransaction,
    updateTransactionStatus,
    upsertTransactionSuccess,
    getTransactionsByWallet,
    getTransactionsByCampaign,
    getTransactionByHash,
};
