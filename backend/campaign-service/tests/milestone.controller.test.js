// tests/milestone.controller.test.js
// Integration test: POST /api/milestones/campaigns/:campaignId/:milestoneIndex/reject
// Mock requireAuth và publishMilestoneFailed để test không phụ thuộc vào JWT/RabbitMQ

require('./setup/dbSetup');

const request = require('supertest');
const express = require('express');
const { Campaign, Milestone } = require('../models');

// ─── Mock các dependency bên ngoài ───────────────────────────────────────────
// Mock RabbitMQ publisher để test không cần kết nối message queue thật
jest.mock('../config/rabbitmq', () => ({
    getChannel: jest.fn(() => null),
    connectRabbitMQ: jest.fn(),
}));

// Mock publishMilestoneFailed để kiểm tra nó có được gọi không
const mockPublishMilestoneFailed = jest.fn().mockResolvedValue(true);
jest.mock('../controllers/milestone.controller', () => {
    const original = jest.requireActual('../controllers/milestone.controller');
    return original;
}, { virtual: false });

// Mock notification service
jest.mock('../services/notificationService', () => ({
    createNotification: jest.fn().mockResolvedValue(null),
}), { virtual: true });

// ─── Setup app với reviewer auth giả ─────────────────────────────────────────
const milestoneRoutes = require('../routes/milestone.routes');
const errorHandler = require('../middlewares/errorHandler');

const REVIEWER_WALLET = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const CREATOR_WALLET  = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

function createAppWithReviewer(walletAddress = REVIEWER_WALLET) {
    const app = express();
    app.use(express.json());

    // Inject fake auth middleware: giả lập reviewer đã đăng nhập
    app.use((req, _res, next) => {
        req.user = { walletAddress };
        next();
    });

    app.use('/api/milestones', milestoneRoutes);
    app.use(errorHandler);
    return app;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
async function seedCampaignAndMilestone(onChainId = 1) {
    const campaign = await Campaign.create({
        onChainId,
        title: 'Test',
        creator: CREATOR_WALLET,
        beneficiary: CREATOR_WALLET,
        goalWei: '1000000000000000000',
        totalRaisedWei: '1000000000000000000',
        totalDisbursedWei: '0',
        deadline: new Date(Date.now() + 86400000),
        status: 'in_progress',
        reviewerSafe: REVIEWER_WALLET,
        milestoneCount: 2,
        currentMilestoneId: 0,
    });

    const milestone = await Milestone.create({
        campaignId: campaign._id,
        campaignOnChainId: onChainId,
        milestoneId: 0,
        milestoneIndex: 0,
        title: 'Milestone 0',
        allocationBps: 3000,
        status: 'pending_review',
        maxRetries: 3,
        rejectionCount: 0,
        deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 ngày từ bây giờ
    });

    return { campaign, milestone };
}

// ─── Tests ───────────────────────────────────────────────────────────────────
describe('POST /api/milestones/campaigns/:campaignId/:milestoneIndex/reject', () => {
    const app = createAppWithReviewer();
    const rejectUrl = (onChainId, milestoneIndex) =>
        `/api/milestones/campaigns/${onChainId}/${milestoneIndex}/reject`;

    it('tăng rejectionCount thêm 1 sau lần từ chối đầu tiên', async () => {
        await seedCampaignAndMilestone(30);

        const res = await request(app)
            .post(rejectUrl(30, 0))
            .send({ reason: 'Thiếu bằng chứng' });

        expect(res.status).toBe(200);
        expect(res.body.data.rejectionCount).toBe(1);
        expect(res.body.data.milestoneStatus).toBe('resubmittable');
        expect(res.body.data.retriesLeft).toBe(2);
    });

    it('milestone trở về resubmittable sau lần từ chối 2', async () => {
        const { campaign } = await seedCampaignAndMilestone(31);
        // Đặt rejectionCount = 1 trước
        await Milestone.findOneAndUpdate(
            { campaignOnChainId: 31, milestoneIndex: 0 },
            { rejectionCount: 1 }
        );

        const res = await request(app)
            .post(rejectUrl(31, 0))
            .send({ reason: 'Bằng chứng không hợp lệ' });

        expect(res.status).toBe(200);
        expect(res.body.data.rejectionCount).toBe(2);
        expect(res.body.data.milestoneStatus).toBe('resubmittable');
        expect(res.body.data.retriesLeft).toBe(1);
    });

    it('milestone chuyển sang failed sau lần từ chối thứ 3 (đạt maxRetries)', async () => {
        await seedCampaignAndMilestone(32);
        // Đặt rejectionCount = 2 (lần này sẽ là lần từ chối thứ 3)
        await Milestone.findOneAndUpdate(
            { campaignOnChainId: 32, milestoneIndex: 0 },
            { rejectionCount: 2 }
        );

        const res = await request(app)
            .post(rejectUrl(32, 0))
            .send({ reason: 'Không đạt yêu cầu lần 3' });

        expect(res.status).toBe(200);
        expect(res.body.data.milestoneStatus).toBe('failed');
        expect(res.body.data.cascadeTriggered).toBe(true);

        // Kiểm tra DB
        const ms = await Milestone.findOne({ campaignOnChainId: 32, milestoneIndex: 0 });
        expect(ms.status).toBe('failed');
        expect(ms.failureReason).toBe('MAX_RETRIES_EXCEEDED');
    });

    it('gia hạn deadline milestone hiện tại thêm 3 ngày khi chưa đạt maxRetries', async () => {
        await seedCampaignAndMilestone(33);

        const msBefore = await Milestone.findOne({ campaignOnChainId: 33, milestoneIndex: 0 });
        const deadlineBefore = msBefore.deadline.getTime();

        await request(app)
            .post(rejectUrl(33, 0))
            .send({ reason: 'Cần bổ sung tài liệu' });

        const msAfter = await Milestone.findOne({ campaignOnChainId: 33, milestoneIndex: 0 });
        const deadlineAfter = msAfter.deadline.getTime();

        const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
        // Deadline phải tăng lên ít nhất 3 ngày
        expect(deadlineAfter - deadlineBefore).toBeGreaterThanOrEqual(threeDaysMs - 1000);
    });

    it('ghi lastRejectionReason vào milestone', async () => {
        await seedCampaignAndMilestone(34);
        const reason = 'Hình ảnh không rõ ràng';

        await request(app)
            .post(rejectUrl(34, 0))
            .send({ reason });

        const ms = await Milestone.findOne({ campaignOnChainId: 34, milestoneIndex: 0 });
        expect(ms.lastRejectionReason).toBe(reason);
    });

    it('trả về 404 nếu campaign không tồn tại', async () => {
        const res = await request(app)
            .post(rejectUrl(9999, 0))
            .send({ reason: 'test' });

        expect(res.status).toBe(404);
    });

    it('trả về 404 nếu milestone không tồn tại', async () => {
        await seedCampaignAndMilestone(35);

        const res = await request(app)
            .post(rejectUrl(35, 99)) // milestoneIndex = 99 không tồn tại
            .send({ reason: 'test' });

        expect(res.status).toBe(404);
    });
});
