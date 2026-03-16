const Notification = require("../models/Notification.model");

// ── SSE connection store ──────────────────────────────────────
// walletAddress (lowercase) → Set<Express.Response>
const sseClients = new Map();

function registerSSEClient(wallet, res) {
    const key = wallet.toLowerCase();
    if (!sseClients.has(key)) sseClients.set(key, new Set());
    sseClients.get(key).add(res);
}

function unregisterSSEClient(wallet, res) {
    const key = wallet.toLowerCase();
    const clients = sseClients.get(key);
    if (!clients) return;
    clients.delete(res);
    if (clients.size === 0) sseClients.delete(key);
}

/**
 * Push một notification tới tất cả SSE connections đang mở của wallet.
 * @param {string} wallet
 * @param {object} notification - plain object (đã .toObject() nếu cần)
 */
function pushToWallet(wallet, notification) {
    const key = wallet.toLowerCase();
    const clients = sseClients.get(key);
    if (!clients || clients.size === 0) return;

    const id = notification._id
        ? notification._id.toString()
        : String(Date.now());
    const data = JSON.stringify(notification);

    clients.forEach((res) => {
        try {
            res.write(`id: ${id}\nevent: notification\ndata: ${data}\n\n`);
        } catch {
            // Connection closed, client sẽ được cleanup qua req.on("close")
        }
    });
}

// ── DB operations ─────────────────────────────────────────────

/**
 * Tạo notification và push SSE ngay lập tức (nếu client đang kết nối).
 */
async function createNotification({
    recipientWallet,
    type,
    title,
    message,
    campaignOnChainId = null,
    txHash = "",
}) {
    if (!recipientWallet) return null;

    const notification = await Notification.create({
        recipientWallet: recipientWallet.toLowerCase(),
        type,
        title,
        message,
        campaignOnChainId,
        txHash,
    });

    pushToWallet(recipientWallet, notification.toObject());
    return notification;
}

async function getByWallet(wallet, limit = 50) {
    return Notification.find({ recipientWallet: wallet.toLowerCase() })
        .sort({ createdAt: -1 })
        .limit(limit);
}

async function getUnreadByWallet(wallet) {
    return Notification.find({
        recipientWallet: wallet.toLowerCase(),
        read: false,
    }).sort({ createdAt: -1 });
}

async function markAsRead(notificationId, wallet) {
    return Notification.findOneAndUpdate(
        { _id: notificationId, recipientWallet: wallet.toLowerCase() },
        { $set: { read: true } },
        { new: true },
    );
}

async function markAllAsRead(wallet) {
    return Notification.updateMany(
        { recipientWallet: wallet.toLowerCase(), read: false },
        { $set: { read: true } },
    );
}

module.exports = {
    registerSSEClient,
    unregisterSSEClient,
    createNotification,
    getByWallet,
    getUnreadByWallet,
    markAsRead,
    markAllAsRead,
};
