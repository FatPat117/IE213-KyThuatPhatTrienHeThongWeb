const notificationService = require("../services/notification.service");

/**
 * GET /api/notifications/stream
 * Server-Sent Events – giữ kết nối và push notification realtime cho wallet đang đăng nhập.
 */
async function streamNotifications(req, res) {
    const wallet = req.headers["x-wallet-address"];
    if (!wallet) {
        return res
            .status(401)
            .json({ success: false, error: "Yêu cầu đăng nhập" });
    }

    // ── SSE headers ──────────────────────────────────────────
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no"); // tắt nginx buffering
    res.flushHeaders();

    // Xác nhận kết nối thành công
    res.write("event: connected\ndata: {}\n\n");

    notificationService.registerSSEClient(wallet, res);

    // Heartbeat mỗi 25s để giữ kết nối qua proxy
    const heartbeat = setInterval(() => {
        try {
            res.write(":heartbeat\n\n");
        } catch {
            clearInterval(heartbeat);
        }
    }, 25000);

    // Gửi những notification chưa đọc ngay khi mở kết nối (hỗ trợ reconnect)
    const lastEventId = req.headers["last-event-id"];
    try {
        const unread = await notificationService.getUnreadByWallet(wallet);
        for (const n of unread) {
            const nId = n._id.toString();
            // Nếu reconnect, chỉ gửi những notification mới hơn Last-Event-ID
            if (lastEventId && nId <= lastEventId) continue;
            res.write(
                `id: ${nId}\nevent: notification\ndata: ${JSON.stringify(n.toObject())}\n\n`,
            );
        }
    } catch {
        // Không block SSE nếu truy vấn DB lỗi
    }

    // Cleanup khi client disconnect
    req.on("close", () => {
        clearInterval(heartbeat);
        notificationService.unregisterSSEClient(wallet, res);
    });
}

/**
 * GET /api/notifications/me
 * Lấy toàn bộ notifications (mới nhất trước) của wallet đang đăng nhập.
 */
async function getMyNotifications(req, res, next) {
    try {
        const wallet = req.headers["x-wallet-address"];
        if (!wallet) {
            return res
                .status(401)
                .json({ success: false, error: "Yêu cầu đăng nhập" });
        }

        const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
        const notifications = await notificationService.getByWallet(
            wallet,
            limit,
        );
        return res.json({ success: true, data: notifications });
    } catch (err) {
        next(err);
    }
}

/**
 * PATCH /api/notifications/:id/read
 * Đánh dấu một notification là đã đọc.
 */
async function markAsRead(req, res, next) {
    try {
        const wallet = req.headers["x-wallet-address"];
        if (!wallet) {
            return res
                .status(401)
                .json({ success: false, error: "Yêu cầu đăng nhập" });
        }

        const notification = await notificationService.markAsRead(
            req.params.id,
            wallet,
        );
        if (!notification) {
            return res
                .status(404)
                .json({ success: false, error: "Không tìm thấy notification" });
        }
        return res.json({ success: true, data: notification });
    } catch (err) {
        next(err);
    }
}

/**
 * PATCH /api/notifications/read-all
 * Đánh dấu tất cả notifications của wallet là đã đọc.
 */
async function markAllAsRead(req, res, next) {
    try {
        const wallet = req.headers["x-wallet-address"];
        if (!wallet) {
            return res
                .status(401)
                .json({ success: false, error: "Yêu cầu đăng nhập" });
        }

        await notificationService.markAllAsRead(wallet);
        return res.json({ success: true });
    } catch (err) {
        next(err);
    }
}

module.exports = {
    streamNotifications,
    getMyNotifications,
    markAsRead,
    markAllAsRead,
};
