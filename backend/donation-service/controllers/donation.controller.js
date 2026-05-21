const donationService = require("../services/donation.service");
const { successRes, errorRes } = require("../utils/response");
const { getCache, setCache } = require("../utils/cache");

// GET /api/donations/campaign/:id
async function getDonationsByCampaign(req, res, next) {
    try {
        const cacheKey = `donation:campaign:${req.params.id}`;
        const cachedData = await getCache(cacheKey);
        if (cachedData) return successRes(res, cachedData);

        const donations = await donationService.getMergedDonationsByCampaign(req.params.id);
        
        await setCache(cacheKey, donations, 300); // 5 mins
        return successRes(res, donations);
    } catch (err) { next(err); }
}

// GET /api/donations/donor/:wallet
async function getDonationsByDonor(req, res, next) {
    try {
        const cacheKey = `donation:donor:${req.params.wallet.toLowerCase()}`;
        const cachedData = await getCache(cacheKey);
        if (cachedData) return successRes(res, cachedData);

        const donations = await donationService.getDonationsByDonor(req.params.wallet);

        await setCache(cacheKey, donations, 300); // 5 mins
        return successRes(res, donations);
    } catch (err) { next(err); }
}

// GET /api/donations/campaign/:id/donor/:wallet
async function getDonationsByCampaignAndDonor(req, res, next) {
    try {
        const donations = await donationService.getMergedDonationsByCampaignAndDonor(
            req.params.id,
            req.params.wallet,
        );
        return successRes(res, donations);
    } catch (err) { next(err); }
}

// GET /api/donations/leaderboard/top-donors?limit=10
async function getTopDonors(req, res, next) {
    try {
        const limit = Math.min(parseInt(req.query.limit, 10) || 10, 100);
        const cacheKey = `donation:leaderboard:${limit}`;
        const cachedData = await getCache(cacheKey);
        if (cachedData) return successRes(res, cachedData);

        const topDonors = await donationService.getTopDonors(limit);
        
        await setCache(cacheKey, topDonors, 600); // 10 mins
        return successRes(res, topDonors);
    } catch (err) { next(err); }
}

module.exports = {
    getDonationsByCampaign,
    getDonationsByDonor,
    getDonationsByCampaignAndDonor,
    getTopDonors,
};
