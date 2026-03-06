const mongoose = require("mongoose");

async function connectDB() {
    const uri = process.env.MONGO_URI;
    if (!uri) {
        console.warn("[donation-service] MONGO_URI chưa cấu hình – bỏ qua kết nối DB");
        return;
    }
    try {
        await mongoose.connect(uri);
        console.log("[donation-service] MongoDB connected");
    } catch (err) {
        console.error("[donation-service] MongoDB connection error:", err.message);
        process.exit(1);
    }
}

module.exports = { connectDB };
