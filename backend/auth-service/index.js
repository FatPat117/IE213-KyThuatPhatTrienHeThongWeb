require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const { connectDB } = require("./config/db");
const authRoutes = require("./routes/auth.routes");
const errorHandler = require("./middlewares/errorHandler");
const { swaggerUi, specs } = require("./config/swagger");

const app = express();
const PORT = process.env.PORT || 4006;

app.use(helmet());
app.use(cors());
app.use(morgan("dev"));
app.use(express.json());

// Health check
app.get("/api/health", (req, res) =>
    res.json({ success: true, service: "auth-service", status: "ok" })
);

// Swagger
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(specs));
app.get("/api-docs.json", (req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.send(specs);
});
// Alias cho gateway proxy
app.get("/api/auth/api-docs.json", (req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.send(specs);
});

// Routes
app.use("/api/auth", authRoutes);

// Error handler
app.use(errorHandler);

async function start() {
    await connectDB();
    app.listen(PORT, () => {
        console.log(`[auth-service] Running at http://localhost:${PORT}`);
    });
}

start().catch((err) => {
    console.error("[auth-service] Startup failed:", err.message);
    process.exit(1);
});
