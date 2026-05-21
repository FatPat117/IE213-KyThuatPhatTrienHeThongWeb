require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const { createProxyMiddleware } = require("http-proxy-middleware");
const swaggerUi = require("swagger-ui-express");

const {
    verifyToken,
    requireAuth,
    requireRole,
} = require("./middlewares/auth.middleware");
const {
    globalLimiter,
    authLimiter,
    heavyLimiter,
} = require("./middlewares/rateLimit.middleware");

const app = express();
const PORT = process.env.PORT || 4000;

app.set("trust proxy", 1); // Tin tưởng proxy (Caddy/Nginx) để lấy đúng IP người dùng

// ── Middlewares ──────────────────────────────────────────────
app.use(helmet());
app.use(cors());
app.use(morgan("dev"));
app.use(globalLimiter); // Áp dụng giới hạn chung cho toàn bộ Gateway

// ── Health Check ─────────────────────────────────────────────
app.get("/api/health", (req, res) =>
    res.json({ success: true, service: "api-gateway", status: "ok" }),
);

// ── Swagger UI (Centralized) ──────────────────────────────────
const swaggerUrls = [
    { url: "/api/auth/api-docs.json", name: "Auth Service" },
    { url: "/api/users/api-docs.json", name: "User Service" },
    { url: "/api/campaigns/api-docs.json", name: "Campaign Service" },
    { url: "/api/donations/api-docs.json", name: "Donation Service" },
    { url: "/api/certificates/api-docs.json", name: "Certificate Service" },
    { url: "/api/transactions/api-docs.json", name: "Transaction Service" },
];

app.use(
    "/api-docs",
    swaggerUi.serve,
    swaggerUi.setup(null, {
        explorer: true,
        swaggerOptions: { urls: swaggerUrls },
    }),
);

// ── Service URLs ─────────────────────────────────────────────
const AUTH_SERVICE_URL =
    process.env.AUTH_SERVICE_URL || "http://auth-service:4006";
const USER_SERVICE_URL =
    process.env.USER_SERVICE_URL || "http://user-service:4001";
const CAMPAIGN_SERVICE_URL =
    process.env.CAMPAIGN_SERVICE_URL || "http://campaign-service:4002";
const DONATION_SERVICE_URL =
    process.env.DONATION_SERVICE_URL || "http://donation-service:4003";
const CERTIFICATE_SERVICE_URL =
    process.env.CERTIFICATE_SERVICE_URL || "http://certificate-service:4004";
const TRANSACTION_SERVICE_URL =
    process.env.TRANSACTION_SERVICE_URL || "http://transaction-service:4005";

// ── Proxy Helper ─────────────────────────────────────────────
const proxy = (target) =>
    createProxyMiddleware({
        target,
        changeOrigin: true,
        pathRewrite: (path, req) => req.originalUrl.split("?")[0],
        on: {
            error: (err, req, res) => {
                console.error(
                    `[gateway] Proxy error → ${target}:`,
                    err.message,
                );
                res.status(502).json({
                    success: false,
                    error: "Service unavailable",
                });
            },
        },
    });

// SSE proxy – tắt timeout để streaming không bị ngắt
const sseProxy = (target) =>
    createProxyMiddleware({
        target,
        changeOrigin: true,
        pathRewrite: (path, req) => req.originalUrl.split("?")[0],
        proxyTimeout: 0,
        timeout: 0,
        on: {
            error: (err, req, res) => {
                console.error(
                    `[gateway] SSE Proxy error → ${target}:`,
                    err.message,
                );
                if (!res.headersSent) {
                    res.status(502).json({
                        success: false,
                        error: "Service unavailable",
                    });
                }
            },
        },
    });

// ── Swagger JSON specs – public, no auth ─────────────────────
// Đặt TRƯỚC các route auth; mỗi service tự expose alias path
app.get("/api/auth/api-docs.json", proxy(AUTH_SERVICE_URL));
app.get("/api/users/api-docs.json", proxy(USER_SERVICE_URL));
app.get("/api/campaigns/api-docs.json", proxy(CAMPAIGN_SERVICE_URL));
app.get("/api/donations/api-docs.json", proxy(DONATION_SERVICE_URL));
app.get("/api/certificates/api-docs.json", proxy(CERTIFICATE_SERVICE_URL));
app.get("/api/transactions/api-docs.json", proxy(TRANSACTION_SERVICE_URL));

// ── Routes (Centralized Auth & Rate Limiting) ────────────────

// 1. Auth Service (Luôn public, có authLimiter)
app.use("/api/auth", authLimiter, proxy(AUTH_SERVICE_URL));

// 2. User Service
//   GET /api/users/:wallet -> public (sử dụng Regex object để tránh lỗi PathError trong Express 5)
app.get(/^\/api\/users\/(0x[a-fA-F0-9]{40})$/, verifyToken, proxy(USER_SERVICE_URL));

//   Admin routes
app.use("/api/users/admin", verifyToken, requireRole("admin"), proxy(USER_SERVICE_URL));

//   Các route khác của users (ví dụ /me, /settings) -> yêu cầu auth
app.use("/api/users", verifyToken, requireAuth, proxy(USER_SERVICE_URL));

// 3. Campaign Service
//   Các route public (GET)
app.get("/api/campaigns", verifyToken, proxy(CAMPAIGN_SERVICE_URL));
app.get(/^\/api\/campaigns\/public\/.*/, verifyToken, proxy(CAMPAIGN_SERVICE_URL));
//   Chi tiết campaign (hỗ trợ cả on-chain ID hoặc MongoDB ID)
app.get(/^\/api\/campaigns\/(0x[a-fA-F0-9]+|[a-fA-F0-9]{24}|[0-9]+)$/, verifyToken, proxy(CAMPAIGN_SERVICE_URL));
app.get(/^\/api\/campaigns\/(0x[a-fA-F0-9]+|[a-fA-F0-9]{24}|[0-9]+)\/status$/, verifyToken, proxy(CAMPAIGN_SERVICE_URL));

//   Reviewers — danh sách hồ sơ cho mọi user đã đăng nhập (vd. trang tạo chiến dịch)
app.get(
    "/api/campaigns/reviewers/admin/profiles",
    verifyToken,
    requireAuth,
    proxy(CAMPAIGN_SERVICE_URL),
);
//   Reviewers — chỉnh/sửa admin
app.use(
    "/api/campaigns/reviewers/admin",
    verifyToken,
    requireRole("admin"),
    proxy(CAMPAIGN_SERVICE_URL),
);
app.use("/api/campaigns/reviewers", verifyToken, requireAuth, proxy(CAMPAIGN_SERVICE_URL));

//   Write operations (Auth)
app.put(/^\/api\/campaigns\/(0x[a-fA-F0-9]+|[a-fA-F0-9]{24}|[0-9]+)\/metadata$/, verifyToken, requireAuth, proxy(CAMPAIGN_SERVICE_URL));
app.patch(/^\/api\/campaigns\/(0x[a-fA-F0-9]+|[a-fA-F0-9]{24}|[0-9]+)\/status$/, verifyToken, requireRole("admin"), proxy(CAMPAIGN_SERVICE_URL));
app.post(/^\/api\/campaigns\/(0x[a-fA-F0-9]+|[a-fA-F0-9]{24}|[0-9]+)\/reject$/, verifyToken, requireRole("admin"), proxy(CAMPAIGN_SERVICE_URL));

//   Milestones
app.get("/api/milestones/:id/approval-status", verifyToken, requireAuth, proxy(CAMPAIGN_SERVICE_URL));
app.use("/api/milestones", verifyToken, proxy(CAMPAIGN_SERVICE_URL)); // Các route milestone khác mặc định public

// 4. Donation Service
app.get("/api/donations/campaign/:id", verifyToken, proxy(DONATION_SERVICE_URL));
app.use("/api/donations", verifyToken, requireAuth, proxy(DONATION_SERVICE_URL));

// 5. Certificate Service (Public)
app.use("/api/certificates", verifyToken, proxy(CERTIFICATE_SERVICE_URL));

// 6. Transaction Service
app.get("/api/transactions/campaign/:id", verifyToken, proxy(TRANSACTION_SERVICE_URL));
app.use("/api/transactions", verifyToken, requireAuth, proxy(TRANSACTION_SERVICE_URL));

// 7. Notifications (SSE & API)
app.get("/api/notifications/stream", verifyToken, requireAuth, sseProxy(CAMPAIGN_SERVICE_URL));
app.use("/api/notifications", verifyToken, requireAuth, proxy(CAMPAIGN_SERVICE_URL));

// ── 404 Fallback ─────────────────────────────────────────────
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: "Route không tồn tại trong gateway",
    });
});

app.listen(PORT, () => {
    console.log(`[api-gateway] Running at http://localhost:${PORT}`);
    console.log(`  /api/auth         → ${AUTH_SERVICE_URL}`);
    console.log(`  /api/users        → ${USER_SERVICE_URL}`);
    console.log(`  /api/campaigns    → ${CAMPAIGN_SERVICE_URL}`);
    console.log(`  /api/donations    → ${DONATION_SERVICE_URL}`);
    console.log(`  /api/certificates → ${CERTIFICATE_SERVICE_URL}`);
    console.log(`  /api/transactions → ${TRANSACTION_SERVICE_URL}`);
});
