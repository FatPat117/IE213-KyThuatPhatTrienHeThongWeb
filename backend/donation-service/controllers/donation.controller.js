const donationService = require("../services/donation.service");
const { successRes, errorRes } = require("../utils/response");

// GET /api/donations/campaign/:id
async function getDonationsByCampaign(req, res, next) {
    try {
        const donations = await donationService.getMergedDonationsByCampaign(req.params.id);
        return successRes(res, donations);
    } catch (err) { next(err); }
}

// GET /api/donations/donor/:wallet
async function getDonationsByDonor(req, res, next) {
    try {
        const donations = await donationService.getDonationsByDonor(req.params.wallet);
        return successRes(res, donations);
    } catch (err) { next(err); }
}

// GET /api/donations/leaderboard/top-donors?limit=10
async function getTopDonors(req, res, next) {
    try {
        const limit = Math.min(parseInt(req.query.limit, 10) || 10, 100);
        const topDonors = await donationService.getTopDonors(limit);
        return successRes(res, topDonors);
    } catch (err) { next(err); }
}

module.exports = { getDonationsByCampaign, getDonationsByDonor, getTopDonors };
