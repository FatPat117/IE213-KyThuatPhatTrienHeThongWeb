const mongoose = require("mongoose");

async function connectDB() {
    const uri = process.env.MONGO_URI;
    if (!uri) {
        console.warn("[user-service] MONGO_URI chưa cấu hình – bỏ qua kết nối DB");
        return;
    }
    try {
        await mongoose.connect(uri);
        console.log("[user-service] MongoDB connected");
    } catch (err) {
        console.error("[user-service] MongoDB connection error:", err.message);
        process.exit(1);
    }
}

module.exports = { connectDB };
