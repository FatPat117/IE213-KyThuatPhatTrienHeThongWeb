require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const { connectDB } = require("./config/db");
const { connectRabbitMQ } = require("./config/rabbitmq");
const { startCertificateMintedConsumer } = require("./consumers/certificateMinted.consumer");
const certificateRoutes = require("./routes/certificate.routes");
const errorHandler = require("./middlewares/errorHandler");

const app = express();
const PORT = process.env.PORT || 4004;

app.use(helmet());
app.use(cors());
app.use(morgan("dev"));
app.use(express.json());

app.get("/api/health", (req, res) =>
    res.json({ success: true, service: "certificate-service", status: "ok" })
);

// Swagger setup
const { swaggerUi, specs } = require("./config/swagger");
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(specs));
// Endpoint for Gateway to fetch the JSON
app.get("/api-docs.json", (req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.send(specs);
});

app.use("/api/certificates", certificateRoutes);
app.use(errorHandler);

async function start() {
    await connectDB();
    await connectRabbitMQ();
    // TODO: Kích hoạt consumer sau khi NFT contract sẵn sàng
    await startCertificateMintedConsumer();
    app.listen(PORT, () => {
        console.log(`[certificate-service] Running at http://localhost:${PORT}`);
    });
}

start().catch((err) => {
    console.error("[certificate-service] Startup failed:", err.message);
    process.exit(1);
});
