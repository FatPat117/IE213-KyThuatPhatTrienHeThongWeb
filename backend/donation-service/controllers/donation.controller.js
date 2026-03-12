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

module.exports = { getDonationsByCampaign, getDonationsByDonor };
