// tests/refundService.test.js
// Integration test cho handleCampaignCascadeFailure
// Sử dụng mongodb-memory-server (được setup bởi globalSetup.js + dbSetup.js)

require('./setup/dbSetup'); // Hook vào beforeAll/afterEach/afterAll

const mongoose = require('mongoose');
const { Campaign, Milestone, CampaignDonorShare, CampaignRefund } = require('../models');
const { handleCampaignCascadeFailure } = require('../services/refundService');

// ─── Helper: Tạo campaign trong DB ──────────────────────────────────────────
async function createCampaign(overrides = {}) {
    return Campaign.create({
        onChainId: 1,
        title: 'Test Campaign',
        creator: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        beneficiary: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        goalWei: '1000000000000000000', // 1 ETH
        totalRaisedWei: '1000000000000000000',
        totalDisbursedWei: '0',
        deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        status: 'in_progress',
        milestoneCount: 2,
        ...overrides,
    });
}

async function createMilestone(campaignId, campaignOnChainId, overrides = {}) {
    return Milestone.create({
        campaignId,
        campaignOnChainId,
        milestoneId: 0,
        milestoneIndex: 0,
        allocationBps: 3000,
        status: 'failed',
        deadline: new Date(Date.now() - 1000),
        ...overrides,
    });
}

async function createDonorShare(campaignId, campaignOnChainId, donorAddress, amountWei) {
    return CampaignDonorShare.create({
        campaignId,
        campaignOnChainId,
        donorAddress,
        donorTotalContributionWei: amountWei,
    });
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('refundService.handleCampaignCascadeFailure', () => {
    const DONOR_A = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const DONOR_B = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
    const ONE_ETH = '1000000000000000000';

    it('ném lỗi nếu campaign không tồn tại', async () => {
        await expect(handleCampaignCascadeFailure(9999)).rejects.toThrow(
            'Campaign not found: onChainId=9999'
        );
    });

    it('bỏ qua nếu campaign đã ở trạng thái partial_failed', async () => {
        const campaign = await createCampaign({ status: 'partial_failed', onChainId: 2 });
        const result = await handleCampaignCascadeFailure(2);

        expect(result.alreadyStopped).toBe(true);

        // DB không thay đổi
        const reloaded = await Campaign.findById(campaign._id);
        expect(reloaded.status).toBe('partial_failed');
    });

    it('bỏ qua nếu campaign đã ở trạng thái failed', async () => {
        await createCampaign({ status: 'failed', onChainId: 3 });
        const result = await handleCampaignCascadeFailure(3);
        expect(result.alreadyStopped).toBe(true);
    });

    describe('khi campaign in_progress → milestone thất bại → partial_failed', () => {
        it('cập nhật campaign.status thành partial_failed khi đã giải ngân một phần', async () => {
            const campaign = await createCampaign({
                onChainId: 10,
                totalRaisedWei: ONE_ETH,
                totalDisbursedWei: '300000000000000000', // đã giải ngân 0.3 ETH (30%)
            });
            await createMilestone(campaign._id, 10, { status: 'disbursed', financialTargetWei: '300000000000000000' });
            await createMilestone(campaign._id, 10, { milestoneId: 1, milestoneIndex: 1, status: 'failed', financialTargetWei: '700000000000000000' });
            await createDonorShare(campaign._id, 10, DONOR_A, ONE_ETH);

            await handleCampaignCascadeFailure(10);

            const updated = await Campaign.findOne({ onChainId: 10 });
            expect(updated.status).toBe('partial_failed');
        });

        it('cập nhật campaign.status thành failed khi chưa giải ngân gì (active)', async () => {
            const campaign = await createCampaign({
                onChainId: 11,
                status: 'active',
                totalRaisedWei: '500000000000000000', // 0.5 ETH < goal (1 ETH)
                totalDisbursedWei: '0',
                goalWei: ONE_ETH,
            });
            await createDonorShare(campaign._id, 11, DONOR_A, '500000000000000000');

            await handleCampaignCascadeFailure(11);

            const updated = await Campaign.findOne({ onChainId: 11 });
            expect(updated.status).toBe('failed');
        });

        it('tạo CampaignRefund records đúng số lượng cho mỗi donor', async () => {
            const campaign = await createCampaign({ onChainId: 12, totalDisbursedWei: '0' });
            await createMilestone(campaign._id, 12);
            await createDonorShare(campaign._id, 12, DONOR_A, ONE_ETH); // 100% share

            await handleCampaignCascadeFailure(12);

            const refunds = await CampaignRefund.find({ campaignId: campaign._id });
            expect(refunds.length).toBe(1);
            expect(refunds[0].donorAddress).toBe(DONOR_A);
            expect(refunds[0].status).toBe('eligible');
        });

        it('tính toán số tiền pro-rata chính xác cho nhiều donors', async () => {
            // Campaign: totalRaised = 1 ETH, disbursed = 0.3 ETH → remaining = 0.7 ETH
            // Donor A: 0.6 ETH (60%) → eligible = 0.6 * 0.7 = 0.42 ETH
            // Donor B: 0.4 ETH (40%) → eligible = 0.4 * 0.7 = 0.28 ETH
            const campaign = await createCampaign({
                onChainId: 13,
                totalRaisedWei: ONE_ETH,
                totalDisbursedWei: '300000000000000000',
            });
            await createMilestone(campaign._id, 13, {
                status: 'disbursed',
                financialTargetWei: '300000000000000000',
            });
            await createMilestone(campaign._id, 13, {
                milestoneId: 1, milestoneIndex: 1, status: 'failed',
                financialTargetWei: '700000000000000000',
            });
            await createDonorShare(campaign._id, 13, DONOR_A, '600000000000000000');
            await createDonorShare(campaign._id, 13, DONOR_B, '400000000000000000');

            await handleCampaignCascadeFailure(13);

            const refundA = await CampaignRefund.findOne({ campaignId: campaign._id, donorAddress: DONOR_A });
            const refundB = await CampaignRefund.findOne({ campaignId: campaign._id, donorAddress: DONOR_B });

            // remaining = 0.7 ETH
            expect(BigInt(refundA.eligibleRefundWei)).toBe(420000000000000000n); // 0.42 ETH
            expect(BigInt(refundB.eligibleRefundWei)).toBe(280000000000000000n); // 0.28 ETH
        });

        it('không tạo refund records nếu không có donor shares', async () => {
            const campaign = await createCampaign({ onChainId: 14, totalDisbursedWei: '0' });
            await createMilestone(campaign._id, 14);
            // Không có donor shares

            const result = await handleCampaignCascadeFailure(14);
            expect(result.refundsCreated).toBe(0);
        });

        it('là idempotent: không tạo bản ghi trùng nếu gọi lại', async () => {
            const campaign = await createCampaign({ onChainId: 15, totalDisbursedWei: '0' });
            await createMilestone(campaign._id, 15);
            await createDonorShare(campaign._id, 15, DONOR_A, ONE_ETH);

            await handleCampaignCascadeFailure(15);
            // Gọi lần 2 → campaign đã là partial_failed → bỏ qua
            await handleCampaignCascadeFailure(15);

            const refunds = await CampaignRefund.find({ campaignId: campaign._id });
            expect(refunds.length).toBe(1); // vẫn chỉ 1 record
        });

        // ══════════════════════════════════════════════════════
        // EDGE CASE: remainingWei = 0 (đã giải ngân hết toàn bộ)
        // ══════════════════════════════════════════════════════
        it('[EDGE] remainingWei = 0 → không tạo bất kỳ refund record nào', async () => {
            // totalRaised = 1 ETH, totalDisbursed = 1 ETH → remaining = 0
            const campaign = await createCampaign({
                onChainId: 20,
                totalRaisedWei: ONE_ETH,
                totalDisbursedWei: ONE_ETH, // Đã giải ngân hết
            });
            await createMilestone(campaign._id, 20, {
                status: 'disbursed',
                financialTargetWei: ONE_ETH,
            });
            await createDonorShare(campaign._id, 20, DONOR_A, ONE_ETH);

            const result = await handleCampaignCascadeFailure(20);

            // Không còn tiền để hoàn → refundsCreated = 0
            expect(result.refundsCreated).toBe(0);
            expect(result.refundPoolWei).toBe('0');

            const refunds = await CampaignRefund.find({ campaignId: campaign._id });
            expect(refunds.length).toBe(0);
        });

        // ══════════════════════════════════════════════════════
        // EDGE CASE: campaign vừa hết deadline funding (active → failed)
        // ══════════════════════════════════════════════════════
        it('[EDGE] campaign active hết hạn funding, chưa đủ goal → status = failed và tạo refund', async () => {
            // Simulate: funding deadline đã qua, chỉ raise được 0.4 ETH < goal 1 ETH
            const campaign = await createCampaign({
                onChainId: 21,
                status: 'active',
                totalRaisedWei: '400000000000000000',  // 0.4 ETH
                totalDisbursedWei: '0',
                goalWei: ONE_ETH,
                deadline: new Date(Date.now() - 1000), // deadline đã qua
            });
            await createDonorShare(campaign._id, 21, DONOR_A, '250000000000000000');
            await createDonorShare(campaign._id, 21, DONOR_B, '150000000000000000');

            await handleCampaignCascadeFailure(21);

            // Status phải là 'failed' (không phải partial_failed vì chưa disburse)
            const updated = await Campaign.findOne({ onChainId: 21 });
            expect(updated.status).toBe('failed');

            // Cả 2 donors đều được tạo refund record
            const refunds = await CampaignRefund.find({ campaignId: campaign._id });
            expect(refunds.length).toBe(2);
            // Tổng eligible = 0.4 ETH (toàn bộ số tiền đã raise)
            const totalEligible = refunds.reduce(
                (sum, r) => sum + BigInt(r.eligibleRefundWei), 0n
            );
            expect(totalEligible).toBe(400000000000000000n);
        });
    });
});
