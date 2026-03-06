const userService = require("../services/user.service");
const { successRes, errorRes } = require("../utils/response");

// GET /api/users/:wallet – public
async function getUserProfile(req, res, next) {
    try {
        const user = await userService.getUserByWallet(req.params.wallet);
        if (!user) return errorRes(res, "User không tồn tại", 404);
        return successRes(res, user);
    } catch (err) { next(err); }
}

// PUT /api/users/:wallet – cần đăng nhập, chỉ đúng wallet của mình hoặc admin
async function upsertUserProfile(req, res, next) {
    try {
        const callerWallet = req.headers["x-wallet-address"];
        const callerRole = req.headers["x-user-role"];

        // Kiểm tra quyền: user chỉ được sửa chính mình
        if (callerRole !== "admin" && callerWallet !== req.params.wallet.toLowerCase()) {
            return errorRes(res, "Không có quyền sửa profile của người khác", 403);
        }

        const { displayName, avatarUrl } = req.body;
        const updates = {};
        if (displayName !== undefined) updates.displayName = displayName;
        if (avatarUrl !== undefined) updates.avatarUrl = avatarUrl;

        const user = await userService.upsertUser(req.params.wallet, updates);
        return successRes(res, user);
    } catch (err) { next(err); }
}

// GET /api/users/admin/list – admin only
async function listAllUsers(req, res, next) {
    try {
        const callerRole = req.headers["x-user-role"];
        if (callerRole !== "admin") return errorRes(res, "Không có quyền truy cập", 403);

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const users = await userService.listUsers(page, limit);
        return successRes(res, users);
    } catch (err) { next(err); }
}

// PATCH /api/users/admin/:wallet/role – admin only
async function updateUserRole(req, res, next) {
    try {
        const callerRole = req.headers["x-user-role"];
        if (callerRole !== "admin") return errorRes(res, "Không có quyền truy cập", 403);

        const { role } = req.body;
        if (!["user", "admin"].includes(role)) {
            return errorRes(res, "Role không hợp lệ. Chấp nhận: user, admin", 400);
        }

        const user = await userService.updateRole(req.params.wallet, role);
        if (!user) return errorRes(res, "User không tồn tại", 404);
        return successRes(res, user);
    } catch (err) { next(err); }
}

module.exports = { getUserProfile, upsertUserProfile, listAllUsers, updateUserRole };
