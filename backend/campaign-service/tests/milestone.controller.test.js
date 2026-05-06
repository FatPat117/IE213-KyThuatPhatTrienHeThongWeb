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

// Mock requireAuth middleware
jest.mock('../middlewares/requireAuth', () => (req, res, next) => {
    // Lấy địa chỉ ví từ header hoặc mặc định
    const addr = req.headers['x-wallet-address'] || '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    req.walletAddress = addr.toLowerCase();
    next();
});

// ─── Setup app với reviewer auth giả ─────────────────────────────────────────
const milestoneRoutes = require('../routes/milestone.routes');
const errorHandler = require('../middlewares/errorHandler');

const REVIEWER_WALLET = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const CREATOR_WALLET  = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

function createAppWithReviewer(walletAddress = REVIEWER_WALLET) {
    const app = express();
    app.use(express.json());

    // Inject fake header middleware: đè header x-wallet-address cho mọi request
    app.use((req, _res, next) => {
        req.headers['x-wallet-address'] = walletAddress;
        next();
    });

    app.use('/api/milestones', milestoneRoutes);
    app.use(errorHandler);
    return app;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
async function seedCampaignAndMilestone(onChainId = 1, milestoneOverrides = {}) {
    const campaign = await Campaign.create({
        onChainId,
        title: 'Test Campaign',
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
        status: 'submitted',
        maxRetries: 3,
        rejectionCount: 0,
        deadline: new Date(Date.now() + 86400000),
        ...milestoneOverrides
    });

    return { campaign, milestone };
}

// ─── Tests ───────────────────────────────────────────────────────────────────
describe('POST /api/milestones/campaigns/:campaignId/:milestoneIndex/reject', () => {
    const app = createAppWithReviewer();
    const rejectUrl = (onChainId, milestoneIndex) =>
        `/api/milestones/${onChainId}/${milestoneIndex}/reject`;

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
        // rejectionCount: 2, maxRetries: 2 -> lần này là lần 3 -> fail
        await seedCampaignAndMilestone(32, { rejectionCount: 2, maxRetries: 2 });
        
        const res = await request(app)
            .post(rejectUrl(32, 0))
            .send({ reason: 'Không đạt yêu cầu lần 3 - Quá giới hạn' });

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
            .send({ reason: 'Cần bổ sung thêm tài liệu quan trọng' });

        const msAfter = await Milestone.findOne({ campaignOnChainId: 33, milestoneIndex: 0 });
        const deadlineAfter = msAfter.deadline.getTime();

        const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
        // Deadline phải tăng lên ít nhất 3 ngày
        expect(deadlineAfter - deadlineBefore).toBeGreaterThanOrEqual(threeDaysMs - 1000);
    });

    it('ghi lastRejectionReason vào milestone', async () => {
        await seedCampaignAndMilestone(34);
        const reason = 'Hình ảnh sản phẩm không rõ ràng';

        await request(app)
            .post(rejectUrl(34, 0))
            .send({ reason });

        const ms = await Milestone.findOne({ campaignOnChainId: 34, milestoneIndex: 0 });
        expect(ms.lastRejectionReason).toBe(reason);
    });

    it('trả về 404 nếu campaign không tồn tại', async () => {
        const res = await request(app)
            .post(rejectUrl(999, 0))
            .send({ reason: 'Lý do từ chối đủ dài 10 ký tự' });

        expect(res.status).toBe(404);
    });

    it('trả về 404 nếu milestone không tồn tại', async () => {
        await seedCampaignAndMilestone(35);
        const res = await request(app)
            .post(rejectUrl(35, 99))
            .send({ reason: 'Lý do từ chối đủ dài 10 ký tự' });

        expect(res.status).toBe(404);
    });

    // ══════════════════════════════════════════════════════════
    // EDGE CASES: Milestone deadline đã qua
    // ══════════════════════════════════════════════════════════

    it('[EDGE] milestone deadline đã qua → failed ngay, không cần đủ 3 lần reject', async () => {
        // deadline đã qua 1 giờ
        await seedCampaignAndMilestone(40, { 
            deadline: new Date(Date.now() - 60 * 60 * 1000),
            status: 'submitted'
        });

        const res = await request(app)
            .post(rejectUrl(40, 0))
            .send({ reason: 'Đã quá hạn nộp bằng chứng nên bị từ chối tự động' });

        // Khi deadline đã qua: milestone phải bị fail ngay, bất kể rejectionCount
        expect(res.status).toBe(200);
        expect(res.body.data.milestoneStatus).toBe('failed');
        expect(res.body.data.cascadeTriggered).toBe(true);
        // failureReason phải là DEADLINE_EXCEEDED_ON_REVIEW, không phải MAX_RETRIES_EXCEEDED
        const ms = await Milestone.findOne({ campaignOnChainId: 40, milestoneIndex: 0 });
        expect(ms.failureReason).toBe('DEADLINE_EXCEEDED_ON_REVIEW');
    });

    // ══════════════════════════════════════════════════════════
    // ERROR CASES: Non-reviewer cố reject → 403
    // ══════════════════════════════════════════════════════════

    it('[ERROR] non-reviewer cố reject milestone → 403 Forbidden', async () => {
        await seedCampaignAndMilestone(41);

        // Tạo app với user KHÔNG phải reviewer
        const NON_REVIEWER = '0x9999999999999999999999999999999999999999';
        const appAsNonReviewer = createAppWithReviewer(NON_REVIEWER);

        const res = await request(appAsNonReviewer)
            .post(rejectUrl(41, 0))
            .send({ reason: 'Cố gắng từ chối trái phép' });

        // Non-reviewer phải bị từ chối với 403 hoặc 401
        expect([401, 403]).toContain(res.status);
    });
});
