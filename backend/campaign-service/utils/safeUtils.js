const axios = require("axios");

// Module-level global caches (shared across all instances)
const safeOwnersCache = new Map();
const OWNERS_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

const safeInfoCache = new Map();
const INFO_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

const SAFE_API_BASE_URL = "https://api.safe.global/tx-service/sep/api/v1";

/**
 * Get Safe owners with caching and rate limit handling
 * @param {string} safeAddress - Safe address (any case)
 * @returns {Promise<string[]> - Array of owner addresses (lowercased)
 */
async function getSafeOwners(safeAddress) {
  const key = safeAddress.toLowerCase();

  // Check cache
  const cached = safeOwnersCache.get(key);
  if (cached && Date.now() < cached.expiresAt) {
    console.log(`[safeUtils] Cache HIT getSafeOwners: ${key}`);
    return cached.owners;
  }

  console.log(`[safeUtils] Cache MISS getSafeOwners: ${key}`);

  try {
    const checksumSafe = require("ethers").getAddress(safeAddress);
    const url = `${SAFE_API_BASE_URL}/safes/${checksumSafe}/`;

    const res = await axios.get(url, {
      timeout: 15_000,
      // axios ném exception cho status >= 400 theo mặc định, nhưng ta xử lý thủ công
      validateStatus: () => true,
    });

    // Rate limited → return stale cache if available
    if (res.status === 429) {
      console.warn(`[safeUtils] Rate limited for ${key}, using stale cache`);
      if (cached) return cached.owners;
      return [];
    }

    // axios dùng res.status (không phải res.ok như fetch)
    if (res.status < 200 || res.status >= 300) {
      console.warn(`[safeUtils] Safe API error ${res.status} for ${key}`);
      if (cached) return cached.owners;
      return [];
    }

    const data = res.data;
    const owners = Array.isArray(data.owners)
      ? data.owners.map((o) => (o || "").toLowerCase()).filter((o) => /^0x[a-f0-9]{40}$/.test(o))
      : [];

    // Save cache
    safeOwnersCache.set(key, {
      owners,
      expiresAt: Date.now() + OWNERS_CACHE_TTL,
    });

    console.log(`[safeUtils] getSafeOwners for ${key}: found ${owners.length} owners`);
    return owners;
  } catch (error) {
    console.error(`[safeUtils] Error in getSafeOwners for ${key}:`, error.message);
    if (cached) return cached.owners;
    return [];
  }
}

/**
 * Get Safe info (threshold, owners, nonce) with caching
 * @param {string} safeAddress - Safe address (any case)
 * @returns {Promise<Object|null>} - Safe info or null
 */
async function getSafeInfo(safeAddress) {
  const key = safeAddress.toLowerCase();

  // Check cache
  const cached = safeInfoCache.get(key);
  if (cached && Date.now() < cached.expiresAt) {
    console.log(`[safeUtils] Cache HIT getSafeInfo: ${key}`);
    return cached.info;
  }

  console.log(`[safeUtils] Cache MISS getSafeInfo: ${key}`);

  try {
    const checksumSafe = require("ethers").getAddress(safeAddress);
    const url = `${SAFE_API_BASE_URL}/safes/${checksumSafe}/`;

    const res = await axios.get(url, {
      timeout: 15_000,
      validateStatus: () => true,
    });

    // Rate limited → return stale cache if available
    if (res.status === 429) {
      console.warn(`[safeUtils] Rate limited for ${key}, using stale cache`);
      if (cached) return cached.info;
      return null;
    }

    // axios dùng res.status (không phải res.ok như fetch)
    if (res.status < 200 || res.status >= 300) {
      console.warn(`[safeUtils] Safe API error ${res.status} for ${key}`);
      if (cached) return cached.info;
      return null;
    }

    const info = res.data;

    // Save cache
    safeInfoCache.set(key, {
      info,
      expiresAt: Date.now() + INFO_CACHE_TTL,
    });

    return info;
  } catch (error) {
    console.error(`[safeUtils] Error in getSafeInfo for ${key}:`, error.message);
    if (cached) return cached.info;
    return null;
  }
}

/**
 * Clear cache for a specific Safe address (useful for manual invalidation)
 * @param {string} safeAddress
 */
function clearSafeCache(safeAddress) {
  const key = safeAddress.toLowerCase();
  safeOwnersCache.delete(key);
  safeInfoCache.delete(key);
}

/**
 * Get cache statistics (for debugging)
 */
function getCacheStats() {
  return {
    ownersCacheSize: safeOwnersCache.size,
    infoCacheSize: safeInfoCache.size,
  };
}

module.exports = {
  getSafeOwners,
  getSafeInfo,
  clearSafeCache,
  getCacheStats,
};
