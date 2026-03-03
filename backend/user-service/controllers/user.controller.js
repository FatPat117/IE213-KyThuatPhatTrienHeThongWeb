const userService = require("../services/user.service");
const { successRes, errorRes } = require("../utils/response");

// GET /api/users/:wallet
async function getUserProfile(req, res, next) {
    try {
        const user = await userService.getUserByWallet(req.params.wallet);
        if (!user) return errorRes(res, "User không tồn tại", 404);
        return successRes(res, user);
    } catch (err) { next(err); }
}

// PUT /api/users/:wallet  – tạo mới hoặc cập nhật profile
async function upsertUserProfile(req, res, next) {
    try {
        const { displayName, avatarUrl } = req.body;
        const updates = {};
        if (displayName !== undefined) updates.displayName = displayName;
        if (avatarUrl !== undefined) updates.avatarUrl = avatarUrl;
        // TODO: Thêm SIWE signature verify để bảo vệ endpoint này
        const user = await userService.upsertUser(req.params.wallet, updates);
        return successRes(res, user);
    } catch (err) { next(err); }
}

module.exports = { getUserProfile, upsertUserProfile };
