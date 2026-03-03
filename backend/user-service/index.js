require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const { connectDB } = require("./config/db");
const userRoutes = require("./routes/user.routes");
const errorHandler = require("./middlewares/errorHandler");

const app = express();
const PORT = process.env.PORT || 4001;

app.use(helmet());
app.use(cors());
app.use(morgan("dev"));
app.use(express.json());

app.get("/api/health", (req, res) =>
    res.json({ success: true, service: "user-service", status: "ok" })
);
app.use("/api/users", userRoutes);
app.use(errorHandler);

async function start() {
    await connectDB();
    app.listen(PORT, () => {
        console.log(`[user-service] Running at http://localhost:${PORT}`);
    });
}

start().catch((err) => {
    console.error("[user-service] Startup failed:", err.message);
    process.exit(1);
});
