/**
 * Chuẩn hóa response JSON cho toàn bộ service.
 */
function successRes(res, data, statusCode = 200) {
    return res.status(statusCode).json({ success: true, data });
}

function errorRes(res, message, statusCode = 400) {
    return res.status(statusCode).json({ success: false, error: message });
}

module.exports = { successRes, errorRes };
