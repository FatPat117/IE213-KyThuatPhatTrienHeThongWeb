const mongoose = require("mongoose");

async function connectDB() {
    const uri = process.env.MONGO_URI;
    if (!uri) {
        console.warn("[transaction-service] MONGO_URI chưa cấu hình – bỏ qua kết nối DB");
        return;
    }
    try {
        await mongoose.connect(uri);
        console.log("[transaction-service] MongoDB connected");
    } catch (err) {
        console.error("[transaction-service] MongoDB connection error:", err.message);
        process.exit(1);
    }
}

module.exports = { connectDB };
