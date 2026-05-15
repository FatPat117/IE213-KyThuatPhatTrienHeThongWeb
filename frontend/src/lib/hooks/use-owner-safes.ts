"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { getAddress } from "viem";

const SAFE_OWNERS_API_BASE = "https://safe-transaction-sepolia.safe.global/api/v1";
const SAFE_OWNERS_RETRY_AFTER_MS = 90_000;
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

// Module-level global cache (shared across all instances)
interface CacheEntry {
  safes: string[];
  expiresAt: number;
}
const GLOBAL_SAFE_OWNERS_CACHE = new Map<string, CacheEntry>();

// Deduplication: track pending requests per address
const GLOBAL_PENDING_REQUESTS = new Map<string, Promise<string[]>>();

interface UseOwnerSafesReturn {
  walletAddress: string;
  safes: string[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  isConnected: boolean;
}

export function useOwnerSafes(): UseOwnerSafesReturn {
  const { address } = useAccount();

  const normalizedWallet = useMemo(
    () => (address || "").toLowerCase().trim(),
    [address],
  );

  const [safes, setSafes] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryAfter, setRetryAfter] = useState<number>(0);

  const fetchOwnerSafes = useCallback(async (force = false) => {
    console.log('[useOwnerSafes] fetch triggered', { normalizedWallet, retryAfter, force });

    if (!/^0x[a-f0-9]{40}$/.test(normalizedWallet)) {
      console.log('[useOwnerSafes] Invalid wallet address format:', normalizedWallet);
      setSafes([]);
      setError(null);
      return;
    }

    // Check global cache first (unless force refresh)
    const now = Date.now();
    const cached = GLOBAL_SAFE_OWNERS_CACHE.get(normalizedWallet);
    if (!force && cached && now < cached.expiresAt) {
      console.log('[useOwnerSafes] Cache HIT for', normalizedWallet, '->', cached.safes.length, 'safes');
      setSafes(cached.safes);
      setError(null);
      return;
    }

    // Check rate limit
    const nowMs = Date.now();
    if (retryAfter > nowMs) {
      // Use stale cache if available instead of error
      if (cached) {
        console.log('[useOwnerSafes] Rate limited but using stale cache');
        setSafes(cached.safes);
        setError(null);
      } else {
        const errorMsg = `Rate limited. Please retry after ${Math.round((retryAfter - nowMs) / 1000)}s`;
        console.log('[useOwnerSafes]', errorMsg);
        setError(errorMsg);
      }
      return;
    }

    // Deduplication: if a request for this address is already pending, wait for it
    const existingPending = GLOBAL_PENDING_REQUESTS.get(normalizedWallet);
    if (existingPending && !force) {
      console.log('[useOwnerSafes] Request already pending for', normalizedWallet, ' - deduping');
      try {
        const result = await existingPending;
        setSafes(result);
        setError(null);
      } catch {
        // Error already handled in the original request
      }
      return;
    }

    // Create new fetch promise
    const fetchPromise = (async () => {
      setIsLoading(true);
      setError(null);

      try {
        const checksumWallet = getAddress(normalizedWallet);
        const url = `${SAFE_OWNERS_API_BASE}/owners/${checksumWallet}/safes/`;
        console.log('[useOwnerSafes] Fetching:', url);

        const res = await fetch(url, {
          cache: "no-store",
          headers: {
            Accept: "application/json",
          },
        });

        console.log('[useOwnerSafes] Response status:', res.status, res.statusText);

        if (res.status === 429) {
          const retryAfterMs = Date.now() + SAFE_OWNERS_RETRY_AFTER_MS;
          setRetryAfter(retryAfterMs);
          throw new Error(
            `Safe API rate limited. Please retry after ${SAFE_OWNERS_RETRY_AFTER_MS / 1000}s`,
          );
        }

        if (!res.ok) {
          const errorText = await res.text();
          console.log('[useOwnerSafes] Error response body:', errorText);
          throw new Error(`Safe API error: ${res.status} ${res.statusText}`);
        }

        const data = await res.json();
        console.log('[useOwnerSafes] Response data:', data);

        // Safe API returns { safes: [...] } or direct array
        const safesArray = Array.isArray(data) ? data : (data.safes || []);

        // Validate addresses
        const validSafes = safesArray.filter((safe: string) =>
          /^0x[a-f0-9]{40}$/.test((safe || "").toLowerCase()),
        );

        const normalizedSafes = validSafes.map((safe: string) =>
          safe.toLowerCase(),
        );

        console.log('[useOwnerSafes] Final safes list:', normalizedSafes);

        // Update global cache
        GLOBAL_SAFE_OWNERS_CACHE.set(normalizedWallet, {
          safes: normalizedSafes,
          expiresAt: Date.now() + CACHE_TTL_MS,
        });

        setSafes(normalizedSafes);
        setError(null);

        return normalizedSafes;
      } catch (err) {
        console.error('[useOwnerSafes] Error:', err);
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError("Không thể lấy danh sách Safe từ API");
        }
        // Keep stale cache if available
        if (cached) {
          setSafes(cached.safes);
        } else {
          setSafes([]);
        }
        throw err;
      } finally {
        setIsLoading(false);
        GLOBAL_PENDING_REQUESTS.delete(normalizedWallet);
      }
    })();

    GLOBAL_PENDING_REQUESTS.set(normalizedWallet, fetchPromise);
  }, [normalizedWallet, retryAfter]);

  useEffect(() => {
    if (normalizedWallet && /^0x[a-f0-9]{40}$/.test(normalizedWallet)) {
      fetchOwnerSafes();
    } else {
      setSafes([]);
      setError(null);
      // Clear cache for invalid wallet
      if (normalizedWallet) {
        GLOBAL_SAFE_OWNERS_CACHE.delete(normalizedWallet);
      }
    }
  }, [normalizedWallet, fetchOwnerSafes]);

  return {
    walletAddress: normalizedWallet,
    safes,
    isLoading,
    error,
    refetch: () => fetchOwnerSafes(true),
    isConnected: Boolean(address),
  };
}
