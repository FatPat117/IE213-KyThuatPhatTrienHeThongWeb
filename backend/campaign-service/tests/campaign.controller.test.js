// tests/campaign.controller.test.js
// Integration test: GET /api/campaigns/public/campaigns/:onChainId/refund-status

require('./setup/dbSetup');

const request = require('supertest');
const { createTestApp } = require('./setup/testApp');
const { Campaign, CampaignRefund, Donation } = require('../models');

const app = createTestApp();

const DONOR_ADDR = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const NON_DONOR  = '0xcccccccccccccccccccccccccccccccccccccccc';

// ─── Helpers ─────────────────────────────────────────────────────────────────
async function seedCampaign(onChainId = 1, status = 'partial_failed') {
    return Campaign.create({
        onChainId,
        title: 'Test Campaign',
        creator: DONOR_ADDR,
        beneficiary: DONOR_ADDR,
        goalWei: '1000000000000000000',
        totalRaisedWei: '1000000000000000000',
        totalDisbursedWei: '0',
        deadline: new Date(Date.now() + 86400000),
        status,
        milestoneCount: 2,
    });
}

async function seedRefund(campaignId, campaignOnChainId, donorAddress, status = 'eligible') {
    return CampaignRefund.create({
        campaignId,
        campaignOnChainId,
        donorAddress,
        eligibleRefundWei: '700000000000000000',
        refundedWei: '0',
        status,
    });
}

async function seedDonation(campaignOnChainId, donorAddress) {
    return Donation.create({
        campaignOnChainId,
        donor: donorAddress,
        amount: '1000000000000000000',
        txHash: '0xdeadbeef',
        status: 'success',
    });
}

// ─── Tests ───────────────────────────────────────────────────────────────────
describe('GET /api/campaigns/public/campaigns/:onChainId/refund-status', () => {
    it('trả về 400 nếu thiếu query address', async () => {
        const res = await request(app).get('/api/campaigns/public/campaigns/1/refund-status');
        expect(res.status).toBe(400);
    });

    it('trả về status "none" nếu không có refund record nào trong DB', async () => {
        await seedCampaign(20);

        const res = await request(app)
            .get('/api/campaigns/public/campaigns/20/refund-status')
            .query({ address: NON_DONOR });

        expect(res.status).toBe(200);
        expect(res.body.data.status).toBe('none');
    });

    it('trả về status "eligible" khi donor chưa rút tiền', async () => {
        const campaign = await seedCampaign(21);
        await seedRefund(campaign._id, 21, DONOR_ADDR, 'eligible');

        const res = await request(app)
            .get('/api/campaigns/public/campaigns/21/refund-status')
            .query({ address: DONOR_ADDR });

        expect(res.status).toBe(200);
        expect(res.body.data.status).toBe('eligible');
        expect(res.body.data.eligibleRefundWei).toBe('700000000000000000');
    });

    it('trả về status "refunded" khi DB đánh dấu đã hoàn tiền', async () => {
        const campaign = await seedCampaign(22);
        await seedRefund(campaign._id, 22, DONOR_ADDR, 'refunded');

        const res = await request(app)
            .get('/api/campaigns/public/campaigns/22/refund-status')
            .query({ address: DONOR_ADDR });

        expect(res.status).toBe(200);
        expect(res.body.data.status).toBe('refunded');
    });

    it('ưu tiên record "refunded" nếu tồn tại nhiều records', async () => {
        const campaign = await seedCampaign(23);
        // Tạo 2 records: 1 eligible, 1 refunded
        await seedRefund(campaign._id, 23, DONOR_ADDR, 'eligible');
        await CampaignRefund.create({
            campaignId: campaign._id,
            campaignOnChainId: 23,
            donorAddress: DONOR_ADDR,
            milestoneId: 1,
            eligibleRefundWei: '300000000000000000',
            refundedWei: '300000000000000000',
            status: 'refunded',
        });

        const res = await request(app)
            .get('/api/campaigns/public/campaigns/23/refund-status')
            .query({ address: DONOR_ADDR });

        expect(res.body.data.status).toBe('refunded');
    });
});
