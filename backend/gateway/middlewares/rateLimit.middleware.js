const rateLimit = require("express-rate-limit");

/**
 * Global rate limiter: Áp dụng cho toàn bộ API requests.
 */
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 phút
    max: 1000, // Tăng lên để tránh block nhầm trong dev
    message: {
        success: false,
        error: "Quá nhiều yêu cầu từ IP này, vui lòng thử lại sau 15 phút.",
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.method === "OPTIONS", // Không giới hạn cho preflight requests
});

/**
 * Auth rate limiter: Áp dụng cho các route nhạy cảm như login, register.
 */
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 phút
    max: 50, // Tăng nhẹ giới hạn auth
    message: {
        success: false,
        error: "Quá nhiều lần thử đăng nhập, vui lòng thử lại sau 15 phút.",
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.method === "OPTIONS",
});

/**
 * Heavy tasks rate limiter
 */
const heavyLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 phút
    max: 20,
    message: {
        success: false,
        error: "Bạn đang thực hiện các thao tác quá nhanh, vui lòng chậm lại.",
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.method === "OPTIONS",
});

module.exports = {
    globalLimiter,
    authLimiter,
    heavyLimiter,
};
