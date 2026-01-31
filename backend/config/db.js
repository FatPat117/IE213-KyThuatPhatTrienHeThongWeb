const mongoose = require("mongoose");

/**
 * Kết nối MongoDB. Gọi từ index.js khi khởi động.
 * MONGO_URI lấy từ process.env (file .env).
 */
async function connectDB() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.warn("MONGO_URI chưa cấu hình – bỏ qua kết nối DB");
    return;
  }
  try {
    await mongoose.connect(uri);
    console.log("MongoDB connected");
  } catch (err) {
    console.error("MongoDB connection error:", err.message);
    process.exit(1);
  }
}

module.exports = { connectDB };
