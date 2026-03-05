require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const { connectDB } = require("./config/db");
const transactionRoutes = require("./routes/transaction.routes");
const errorHandler = require("./middlewares/errorHandler");

const app = express();
const PORT = process.env.PORT || 4005;

app.use(helmet());
app.use(cors());
app.use(morgan("dev"));
app.use(express.json());

app.get("/api/health", (req, res) =>
    res.json({ success: true, service: "transaction-service", status: "ok" })
);

// Swagger setup
const { swaggerUi, specs } = require("./config/swagger");
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(specs));
// Endpoint for Gateway to fetch the JSON
app.get("/api-docs.json", (req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.send(specs);
});

app.use("/api/transactions", transactionRoutes);
app.use(errorHandler);

async function start() {
    await connectDB();
    // Không cần RabbitMQ – chỉ dùng HTTP REST
    app.listen(PORT, () => {
        console.log(`[transaction-service] Running at http://localhost:${PORT}`);
    });
}

start().catch((err) => {
    console.error("[transaction-service] Startup failed:", err.message);
    process.exit(1);
});
