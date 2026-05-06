// tests/setup/globalTeardown.js
// Dọn dẹp: tắt MongoMemoryServer sau khi tất cả test chạy xong
module.exports = async () => {
    if (global.__MONGOD__) {
        await global.__MONGOD__.stop();
    }
};
