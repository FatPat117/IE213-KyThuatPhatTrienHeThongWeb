require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const { connectDB } = require("./config/db");
const { connectRabbitMQ } = require("./config/rabbitmq");
const { startCampaignCreatedConsumer } = require("./consumers/campaignCreated.consumer");
const campaignRoutes = require("./routes/campaign.routes");
const errorHandler = require("./middlewares/errorHandler");

const app = express();
const PORT = process.env.PORT || 4002;

// ── Middlewares ──────────────────────────────────────────────
app.use(helmet());
app.use(cors());
app.use(morgan("dev"));
app.use(express.json());

// ── Routes ───────────────────────────────────────────────────
app.get("/api/health", (req, res) =>
    res.json({ success: true, service: "campaign-service", status: "ok" })
);
app.use("/api/campaigns", campaignRoutes);

// ── Error Handler ────────────────────────────────────────────
app.use(errorHandler);

// ── Startup ──────────────────────────────────────────────────
async function start() {
    await connectDB();
    await connectRabbitMQ();
    await startCampaignCreatedConsumer();

    app.listen(PORT, () => {
        console.log(`[campaign-service] Running at http://localhost:${PORT}`);
    });
}

start().catch((err) => {
    console.error("[campaign-service] Startup failed:", err.message);
    process.exit(1);
});
