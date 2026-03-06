const mongoose = require("mongoose");

async function connectDB() {
    const uri = process.env.MONGO_URI;
    if (!uri) {
        console.warn("[auth-service] MONGO_URI chưa cấu hình – bỏ qua kết nối DB");
        return;
    }
    try {
        await mongoose.connect(uri);
        console.log("[auth-service] MongoDB connected");
    } catch (err) {
        console.error("[auth-service] MongoDB connection error:", err.message);
        process.exit(1);
    }
}

module.exports = { connectDB };
