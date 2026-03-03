const certificateService = require("../services/certificate.service");
const { successRes, errorRes } = require("../utils/response");

// GET /api/certificates/owner/:wallet
async function getCertificatesByOwner(req, res, next) {
    try {
        const certs = await certificateService.getCertificatesByOwner(req.params.wallet);
        return successRes(res, certs);
    } catch (err) { next(err); }
}

// GET /api/certificates/campaign/:id
async function getCertificatesByCampaign(req, res, next) {
    try {
        const certs = await certificateService.getCertificatesByCampaign(req.params.id);
        return successRes(res, certs);
    } catch (err) { next(err); }
}

module.exports = { getCertificatesByOwner, getCertificatesByCampaign };
