const { errorRes } = require("../utils/response");

function errorHandler(err, req, res, next) {
    console.error("[donation-service] Error:", err.stack);
    const status = err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ success: false, error: message });
}

module.exports = errorHandler;
