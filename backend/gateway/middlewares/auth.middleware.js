const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret-change-this";

/**
 * Middleware xác thực JWT.
 * - Nếu có token hợp lệ → inject req.user = { wallet, role } + forward headers
 * - Nếu không có token → req.user = { role: "guest" } (vẫn cho qua)
 * - Nếu token sai / hết hạn → 401
 */
function verifyToken(req, res, next) {
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(" ")[1];

    if (!token) {
        req.user = { role: "guest" };
        return next();
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        // Inject vào headers để downstream services dùng mà không cần verify lại JWT
        req.headers["x-wallet-address"] = decoded.wallet;
        req.headers["x-user-role"] = decoded.role;
        next();
    } catch {
        return res.status(401).json({ success: false, error: "Token không hợp lệ hoặc đã hết hạn" });
    }
}

/**
 * Yêu cầu đã đăng nhập (role != guest).
 * Dùng sau verifyToken.
 */
function requireAuth(req, res, next) {
    if (!req.user || req.user.role === "guest") {
        return res.status(401).json({ success: false, error: "Yêu cầu đăng nhập" });
    }
    next();
}

/**
 * Yêu cầu một trong các roles cụ thể.
 * Dùng sau verifyToken.
 * Ví dụ: requireRole("admin") hoặc requireRole("admin", "user")
 */
function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({ success: false, error: "Không có quyền truy cập" });
        }
        next();
    };
}

module.exports = { verifyToken, requireAuth, requireRole };
