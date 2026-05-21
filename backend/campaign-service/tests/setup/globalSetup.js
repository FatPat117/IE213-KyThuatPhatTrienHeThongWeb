// tests/setup/globalSetup.js
// Khởi động MongoMemoryServer MỘT lần cho toàn bộ test suite
const { MongoMemoryServer } = require('mongodb-memory-server');

module.exports = async () => {
    const mongoServer = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongoServer.getUri();
    // Lưu instance để globalTeardown có thể dùng để dọn dẹp
    global.__MONGOD__ = mongoServer;
};
