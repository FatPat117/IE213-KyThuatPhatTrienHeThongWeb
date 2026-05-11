const Redis = require('ioredis');

let redisClient = null;

if (process.env.REDIS_URL) {
    redisClient = new Redis(process.env.REDIS_URL, {
        retryStrategy: (times) => {
            const delay = Math.min(times * 50, 2000);
            return delay;
        },
    });

    redisClient.on('error', (err) => {
        console.error('[Redis] Connection Error:', err.message);
    });

    redisClient.on('connect', () => {
        console.log('[Redis] Connected successfully');
    });
} else {
    console.warn('[Redis] REDIS_URL not set. Caching is disabled.');
}

/**
 * Get data from cache
 * @param {string} key Cache key
 * @returns {Promise<Object|null>} Parsed JSON data or null
 */
const getCache = async (key) => {
    if (!redisClient) return null;
    try {
        const data = await redisClient.get(key);
        return data ? JSON.parse(data) : null;
    } catch (err) {
        console.error(`[Redis] Get Error (${key}):`, err.message);
        return null;
    }
};

/**
 * Set data to cache
 * @param {string} key Cache key
 * @param {Object} data Data to cache
 * @param {number} ttl Time to live in seconds (default 300s / 5m)
 */
const setCache = async (key, data, ttl = 300) => {
    if (!redisClient) return;
    try {
        await redisClient.set(key, JSON.stringify(data), 'EX', ttl);
    } catch (err) {
        console.error(`[Redis] Set Error (${key}):`, err.message);
    }
};

/**
 * Delete a specific key from cache
 * @param {string} key Cache key
 */
const delCache = async (key) => {
    if (!redisClient) return;
    try {
        await redisClient.del(key);
    } catch (err) {
        console.error(`[Redis] Del Error (${key}):`, err.message);
    }
};

/**
 * Clear all keys matching a prefix
 * @param {string} prefix Prefix pattern (e.g., 'campaign:list:*')
 */
const clearPrefix = async (prefix) => {
    if (!redisClient) return;
    try {
        const keys = await redisClient.keys(prefix);
        if (keys.length > 0) {
            await redisClient.del(...keys);
            console.log(`[Redis] Cleared ${keys.length} keys matching ${prefix}`);
        }
    } catch (err) {
        console.error(`[Redis] ClearPrefix Error (${prefix}):`, err.message);
    }
};

module.exports = {
    redisClient,
    getCache,
    setCache,
    delCache,
    clearPrefix,
};
