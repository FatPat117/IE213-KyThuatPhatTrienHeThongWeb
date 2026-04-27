const express = require("express");
const {
    streamNotifications,
    getMyNotifications,
    markAsRead,
    markAllAsRead,
} = require("../controllers/notification.controller");

const router = express.Router();

/**
 * GET /api/notifications/stream
 * Server-Sent Events – stream notification realtime (auth required, kiểm tra ở gateway).
 */
router.get("/stream", streamNotifications);

/**
 * GET /api/notifications/me
 * Lấy danh sách notification của wallet đang đăng nhập.
 */
router.get("/me", getMyNotifications);

/**
 * PATCH /api/notifications/read-all
 * Đánh dấu tất cả notification đã đọc (phải khai báo trước /:id để không bị nhầm).
 */
router.patch("/read-all", markAllAsRead);

/**
 * PATCH /api/notifications/:id/read
 * Đánh dấu 1 notification đã đọc.
 */
router.patch("/:id/read", markAsRead);

module.exports = router;
