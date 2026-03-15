const certificateService = require("../services/certificate.service");
const { successRes, errorRes } = require("../utils/response");

// GET /api/certificates/owner/:wallet
async function getCertificatesByOwner(req, res, next) {
    try {
        const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
        const limit = Math.min(
            Math.max(Number.parseInt(req.query.limit, 10) || 20, 1),
            100,
        );
        const paginatedResult = await certificateService.getCertificatesByOwner(
            req.params.wallet,
            { page, limit },
        );

        return successRes(res, {
            items: paginatedResult.items,
            totalItems: paginatedResult.totalItems,
            totalPages: paginatedResult.totalPages,
            currentPage: paginatedResult.currentPage,
        });
    } catch (err) {
        next(err);
    }
}

// GET /api/certificates/campaign/:id
async function getCertificatesByCampaign(req, res, next) {
    try {
        const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
        const limit = Math.min(
            Math.max(Number.parseInt(req.query.limit, 10) || 20, 1),
            100,
        );
        const paginatedResult =
            await certificateService.getCertificatesByCampaign(req.params.id, {
                page,
                limit,
            });

        return successRes(res, {
            items: paginatedResult.items,
            totalItems: paginatedResult.totalItems,
            totalPages: paginatedResult.totalPages,
            currentPage: paginatedResult.currentPage,
        });
    } catch (err) {
        next(err);
    }
}

module.exports = { getCertificatesByOwner, getCertificatesByCampaign };
