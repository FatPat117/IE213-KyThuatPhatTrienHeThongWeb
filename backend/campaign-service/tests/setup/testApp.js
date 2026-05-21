// tests/setup/testApp.js
// Tạo Express app cho Supertest KHÔNG kết nối RabbitMQ / MongoDB (mongoose đã được kết nối bởi dbSetup.js)

const express = require('express');
const campaignRoutes = require('../../routes/campaign.routes');
const milestoneRoutes = require('../../routes/milestone.routes');
const errorHandler = require('../../middlewares/errorHandler');

function createTestApp() {
    const app = express();
    app.use(express.json());

    app.get('/api/health', (_req, res) => res.json({ success: true }));
    app.use('/api/campaigns', campaignRoutes);
    app.use('/api/milestones', milestoneRoutes);
    app.use(errorHandler);

    return app;
}

module.exports = { createTestApp };
