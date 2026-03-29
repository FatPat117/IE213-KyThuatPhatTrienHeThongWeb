const mongoose = require("mongoose");

async function connectDB() {
    const uri = process.env.MONGO_URI;
    if (!uri) {
        console.warn(
            "[campaign-service] MONGO_URI chưa cấu hình – bỏ qua kết nối DB",
        );
        return;
    }
    try {
        await mongoose.connect(uri);
        console.log("[campaign-service] MongoDB connected:", uri);

        // Load all models (Phase 3 milestone system models included)
        // Collections are auto-created by Mongoose on first insert
        require("../models");
        console.log(
            "[campaign-service] Models loaded (collections auto-created on first insert)",
        );
    } catch (err) {
        console.error(
            "[campaign-service] MongoDB connection error:",
            err.message,
        );
        process.exit(1);
    }
}

module.exports = { connectDB };
