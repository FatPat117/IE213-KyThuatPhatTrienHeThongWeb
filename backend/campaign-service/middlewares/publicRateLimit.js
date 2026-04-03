const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS = 100;

const buckets = new Map();

function getClientIp(req) {
    const forwarded = req.headers["x-forwarded-for"];
    if (typeof forwarded === "string" && forwarded.length > 0) {
        return forwarded.split(",")[0].trim();
    }
    return req.ip || req.socket?.remoteAddress || "unknown";
}

function publicRateLimit(req, res, next) {
    const now = Date.now();
    const clientIp = getClientIp(req);
    const current = buckets.get(clientIp);

    if (!current || current.expiresAt <= now) {
        buckets.set(clientIp, {
            count: 1,
            expiresAt: now + WINDOW_MS,
        });
        return next();
    }

    if (current.count >= MAX_REQUESTS) {
        return res.status(429).json({
            success: false,
            error: "Rate limit exceeded for public API",
        });
    }

    current.count += 1;
    buckets.set(clientIp, current);
    return next();
}

module.exports = publicRateLimit;
