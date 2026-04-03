function requireAuth(req, res, next) {
    const walletAddress = (req.headers["x-wallet-address"] || "")
        .toString()
        .trim()
        .toLowerCase();

    if (!walletAddress) {
        return res.status(401).json({
            success: false,
            error: "Authentication required",
        });
    }

    req.walletAddress = walletAddress;
    req.userRole = (req.headers["x-user-role"] || "")
        .toString()
        .trim()
        .toLowerCase();

    return next();
}

module.exports = requireAuth;
