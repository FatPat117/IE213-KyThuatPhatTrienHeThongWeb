require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const { createProxyMiddleware } = require("http-proxy-middleware");

const app = express();
const PORT = process.env.PORT || 4000;

// ── Middlewares ──────────────────────────────────────────────
app.use(helmet());
app.use(cors());
app.use(morgan("dev"));

// ── Health Check ─────────────────────────────────────────────
app.get("/api/health", (req, res) =>
    res.json({ success: true, service: "api-gateway", status: "ok" })
);

// ── Proxy Routes ─────────────────────────────────────────────
// Mỗi prefix được proxy đến microservice tương ứng
// Trong Docker Compose, các service được gọi bằng service name (hostname)

const USER_SERVICE_URL = process.env.USER_SERVICE_URL || "http://user-service:4001";
const CAMPAIGN_SERVICE_URL = process.env.CAMPAIGN_SERVICE_URL || "http://campaign-service:4002";
const DONATION_SERVICE_URL = process.env.DONATION_SERVICE_URL || "http://donation-service:4003";
const CERTIFICATE_SERVICE_URL = process.env.CERTIFICATE_SERVICE_URL || "http://certificate-service:4004";
const TRANSACTION_SERVICE_URL = process.env.TRANSACTION_SERVICE_URL || "http://transaction-service:4005";

const proxyOptions = (target) => ({
    target,
    changeOrigin: true,
    on: {
        error: (err, req, res) => {
            console.error(`[gateway] Proxy error → ${target}:`, err.message);
            res.status(502).json({ success: false, error: "Service unavailable" });
        },
    },
});

app.use("/api/users", createProxyMiddleware(proxyOptions(USER_SERVICE_URL)));
app.use("/api/campaigns", createProxyMiddleware(proxyOptions(CAMPAIGN_SERVICE_URL)));
app.use("/api/donations", createProxyMiddleware(proxyOptions(DONATION_SERVICE_URL)));
app.use("/api/certificates", createProxyMiddleware(proxyOptions(CERTIFICATE_SERVICE_URL)));
app.use("/api/transactions", createProxyMiddleware(proxyOptions(TRANSACTION_SERVICE_URL)));

// ── 404 Fallback ─────────────────────────────────────────────
app.use((req, res) => {
    res.status(404).json({ success: false, error: "Route không tồn tại trong gateway" });
});

app.listen(PORT, () => {
    console.log(`[api-gateway] Running at http://localhost:${PORT}`);
    console.log(`  /api/users        → ${USER_SERVICE_URL}`);
    console.log(`  /api/campaigns    → ${CAMPAIGN_SERVICE_URL}`);
    console.log(`  /api/donations    → ${DONATION_SERVICE_URL}`);
    console.log(`  /api/certificates → ${CERTIFICATE_SERVICE_URL}`);
    console.log(`  /api/transactions → ${TRANSACTION_SERVICE_URL}`);
});
