// tests/setup/dbSetup.js
// Kết nối Mongoose đến MongoMemoryServer trước mỗi test file
// và dọn sạch dữ liệu sau mỗi test để đảm bảo test cô lập

const mongoose = require('mongoose');

beforeAll(async () => {
    // URI được set bởi globalSetup.js
    await mongoose.connect(process.env.MONGODB_URI);
});

afterEach(async () => {
    // Xóa sạch dữ liệu giữa các test để đảm bảo độc lập
    const collections = mongoose.connection.collections;
    for (const key in collections) {
        await collections[key].deleteMany({});
    }
});

afterAll(async () => {
    await mongoose.disconnect();
});
