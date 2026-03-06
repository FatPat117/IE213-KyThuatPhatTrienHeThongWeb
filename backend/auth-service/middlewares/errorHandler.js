function errorHandler(err, req, res, next) {
    console.error("[auth-service] Error:", err.message);
    const status = err.status || 500;
    res.status(status).json({ success: false, error: err.message || "Internal server error" });
}

module.exports = errorHandler;
