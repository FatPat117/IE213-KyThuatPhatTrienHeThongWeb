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

const app = express();
const PORT = process.env.PORT || 4000;

// ── Middlewares ──────────────────────────────────────────────
app.use(helmet());
app.use(cors());
app.use(morgan("dev"));

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

// ── Swagger JSON specs – public, no auth ─────────────────────
// Đặt TRƯỚC các route auth; mỗi service tự expose alias path
app.get("/api/auth/api-docs.json", proxy(AUTH_SERVICE_URL));
app.get("/api/users/api-docs.json", proxy(USER_SERVICE_URL));
app.get("/api/campaigns/api-docs.json", proxy(CAMPAIGN_SERVICE_URL));
app.get("/api/donations/api-docs.json", proxy(DONATION_SERVICE_URL));
app.get("/api/certificates/api-docs.json", proxy(CERTIFICATE_SERVICE_URL));
app.get("/api/transactions/api-docs.json", proxy(TRANSACTION_SERVICE_URL));

// ── Routes ───────────────────────────────────────────────────
//
// Auth – public (guest OK)
app.use("/api/auth", proxy(AUTH_SERVICE_URL));

// Users
//   GET  /api/users/:wallet           → public (guest OK)
//   PUT  /api/users/:wallet           → requireAuth (service kiểm tra ownership)
//   GET  /api/users/admin/*           → requireRole("admin")
//   PATCH /api/users/admin/:wallet/role → requireRole("admin")
app.use("/api/users", verifyToken, proxy(USER_SERVICE_URL));

// Campaigns – read public, write admin
//   GET  /api/campaigns              → public
//   GET  /api/campaigns/:id          → public
//   PATCH /api/campaigns/:id/status  → requireRole("admin")   [enforced in service]
//   PUT  /api/campaigns/:id/metadata → requireAuth            [enforced in service]
app.use("/api/campaigns", verifyToken, proxy(CAMPAIGN_SERVICE_URL));

// Donations
//   GET /api/donations/campaign/:id  → public
//   GET /api/donations/donor/:wallet → requireAuth (service kiểm tra ownership)
app.use("/api/donations", verifyToken, proxy(DONATION_SERVICE_URL));

// Certificates – all public
app.use("/api/certificates", verifyToken, proxy(CERTIFICATE_SERVICE_URL));

// Transactions
//   GET  /api/transactions/campaign/:id → public (verifyToken optional)
//   POST /api/transactions           → requireAuth
//   GET  /api/transactions/:wallet   → requireAuth (service kiểm tra ownership)
//   PATCH /api/transactions/:txHash/status → internal (listener-service), bảo vệ tại service level
app.get(
    "/api/transactions/campaign/:id",
    verifyToken,
    proxy(TRANSACTION_SERVICE_URL),
);
app.use(
    "/api/transactions",
    verifyToken,
    requireAuth,
    proxy(TRANSACTION_SERVICE_URL),
);

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
