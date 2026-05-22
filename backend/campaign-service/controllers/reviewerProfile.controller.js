const { Reviewer } = require("../models");
const { successRes, errorRes } = require("../utils/response");

const MAX_FIELD_LEN = 200;

function toPublic(doc) {
    return {
        reviewerCode: doc.reviewerCode || null,
        walletAddress: doc.walletAddress,
        organizationName: doc.organizationName || "",
        region: doc.region || "",
        isActive: doc.isActive !== false,
    };
}

function toPublicAdmin(doc) {
    const base = toPublic(doc);
    return {
        ...base,
        createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : null,
        updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : null,
    };
}

/**
 * GET /api/campaigns/reviewers/public/profiles
 * Public — tổ chức & vùng phụ trách cho trang chủ (không yêu cầu đăng nhập)
 */
async function listPublicReviewerProfiles(req, res, next) {
    try {
        const docs = await Reviewer.find({ isActive: { $ne: false } })
            .sort({ updatedAt: -1 })
            .lean();
        const data = docs.map(toPublic);
        return successRes(res, data);
    } catch (err) {
        next(err);
    }
}

/**
 * GET /api/campaigns/reviewers/admin/profiles
 * Accessible to any authenticated user (admin or reviewer)
 * PATCH and DELETE endpoints still require admin role
 */
async function listReviewerProfilesForAdmin(req, res, next) {
    try {
        // Admin role check removed - all authenticated users can view reviewer profiles
        const docs = await Reviewer.find({}).sort({ updatedAt: -1 }).lean();
        const data = docs.map(toPublicAdmin);
        return successRes(res, data);
    } catch (err) {
        next(err);
    }
}

/**
 * GET /api/campaigns/reviewers/profile
 */
async function getReviewerProfile(req, res, next) {
    try {
        const wallet = req.walletAddress;
        const doc = await Reviewer.findOne({ walletAddress: wallet });
        if (!doc) {
            return successRes(res, {
                reviewerCode: null,
                walletAddress: wallet,
                organizationName: "",
                region: "",
                isActive: true,
            });
        }
        return successRes(res, toPublic(doc));
    } catch (err) {
        next(err);
    }
}

/**
 * PATCH /api/campaigns/reviewers/profile
 * Body: { organizationName?: string, region?: string }
 */
async function patchReviewerProfile(req, res, next) {
    try {
        const wallet = req.walletAddress;
        const body = req.body || {};
        const hasOrg = Object.prototype.hasOwnProperty.call(
            body,
            "organizationName",
        );
        const hasRegion = Object.prototype.hasOwnProperty.call(body, "region");

        if (!hasOrg && !hasRegion) {
            return errorRes(
                res,
                "Gửi ít nhất một trường: organizationName hoặc region",
                400,
            );
        }

        const updates = {};
        if (hasOrg) {
            updates.organizationName = String(body.organizationName ?? "")
                .trim()
                .slice(0, MAX_FIELD_LEN);
        }
        if (hasRegion) {
            updates.region = String(body.region ?? "")
                .trim()
                .slice(0, MAX_FIELD_LEN);
        }

        const reviewerCode = `RW_${wallet}`;
        const doc = await Reviewer.findOneAndUpdate(
            { walletAddress: wallet },
            {
                $set: {
                    ...updates,
                    isActive: true,
                },
                $setOnInsert: {
                    reviewerCode,
                    walletAddress: wallet,
                },
            },
            { upsert: true, new: true, runValidators: true },
        );

        return successRes(res, toPublic(doc));
    } catch (err) {
        next(err);
    }
}

const WALLET_RE = /^0x[a-fA-F0-9]{40}$/;

/**
 * PATCH /api/campaigns/reviewers/admin/profiles/:walletAddress
 * Body: { organizationName?: string, region?: string, isActive?: boolean }
 * Chỉ admin — dùng khi reviewer dùng Safe không tự cập nhật hồ sơ qua PATCH /reviewers/profile.
 */
async function patchReviewerProfileForAdmin(req, res, next) {
    try {
        const role = (req.headers["x-user-role"] || "")
            .toString()
            .trim()
            .toLowerCase();
        if (role !== "admin") {
            return errorRes(res, "Chỉ admin mới chỉnh sửa được hồ sơ reviewer", 403);
        }

        const rawWallet = decodeURIComponent(
            String(req.params.walletAddress || "").trim(),
        );
        const wallet = rawWallet.toLowerCase();
        if (!WALLET_RE.test(wallet)) {
            return errorRes(res, "Địa chỉ ví không hợp lệ", 400);
        }

        const body = req.body || {};
        const hasOrg = Object.prototype.hasOwnProperty.call(
            body,
            "organizationName",
        );
        const hasRegion = Object.prototype.hasOwnProperty.call(body, "region");
        const hasActive = Object.prototype.hasOwnProperty.call(
            body,
            "isActive",
        );

        if (!hasOrg && !hasRegion && !hasActive) {
            return errorRes(
                res,
                "Gửi ít nhất một trường: organizationName, region hoặc isActive",
                400,
            );
        }

        const updates = {};
        if (hasOrg) {
            updates.organizationName = String(body.organizationName ?? "")
                .trim()
                .slice(0, MAX_FIELD_LEN);
        }
        if (hasRegion) {
            updates.region = String(body.region ?? "")
                .trim()
                .slice(0, MAX_FIELD_LEN);
        }
        if (hasActive) {
            updates.isActive = Boolean(body.isActive);
        }

        const reviewerCode = `RW_${wallet}`;
        const doc = await Reviewer.findOneAndUpdate(
            { walletAddress: wallet },
            {
                $set: updates,
                $setOnInsert: {
                    reviewerCode,
                    walletAddress: wallet,
                },
            },
            { upsert: true, new: true, runValidators: true },
        );

        return successRes(res, toPublicAdmin(doc));
    } catch (err) {
        next(err);
    }
}

/**
 * DELETE /api/campaigns/reviewers/admin/profiles/:walletAddress
 * Xóa nội dung hồ sơ: tổ chức và tỉnh/thành về rỗng (giữ bản ghi, mã RW_, ví).
 */
async function clearReviewerProfileForAdmin(req, res, next) {
    try {
        const role = (req.headers["x-user-role"] || "")
            .toString()
            .trim()
            .toLowerCase();
        if (role !== "admin") {
            return errorRes(res, "Chỉ admin mới xóa được hồ sơ reviewer", 403);
        }

        const rawWallet = decodeURIComponent(
            String(req.params.walletAddress || "").trim(),
        );
        const wallet = rawWallet.toLowerCase();
        if (!WALLET_RE.test(wallet)) {
            return errorRes(res, "Địa chỉ ví không hợp lệ", 400);
        }

        const doc = await Reviewer.findOneAndUpdate(
            { walletAddress: wallet },
            { $set: { organizationName: "", region: "" } },
            { new: true, runValidators: true },
        );

        if (!doc) {
            return errorRes(
                res,
                "Chưa có hồ sơ cho ví này trên hệ thống",
                404,
            );
        }

        return successRes(res, toPublicAdmin(doc));
    } catch (err) {
        next(err);
    }
}

module.exports = {
    getReviewerProfile,
    patchReviewerProfile,
    listPublicReviewerProfiles,
    listReviewerProfilesForAdmin,
    patchReviewerProfileForAdmin,
    clearReviewerProfileForAdmin,
};
