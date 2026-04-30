"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAccount } from "wagmi";
import { getAddress } from "viem";

const SAFE_OWNERS_API_BASE = "https://safe-transaction-sepolia.safe.global/api/v1";
const SAFE_OWNERS_RETRY_AFTER_MS = 90_000;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CacheEntry {
    safes: string[];
    timestamp: number;
}

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
  const cacheRef = useRef<Map<string, CacheEntry>>(new Map());

  const fetchOwnerSafes = useCallback(async (force = false) => {
    console.log('[useOwnerSafes] fetch triggered', { normalizedWallet, retryAfter, force });

    if (!/^0x[a-f0-9]{40}$/.test(normalizedWallet)) {
      console.log('[useOwnerSafes] Invalid wallet address format:', normalizedWallet);
      setSafes([]);
      setError(null);
      return;
    }

    // Check cache first (unless force refresh)
    const now = Date.now();
    const cached = cacheRef.current.get(normalizedWallet);
    if (!force && cached && (now - cached.timestamp) < CACHE_TTL_MS) {
      console.log('[useOwnerSafes] Using cached safes:', cached.safes);
      setSafes(cached.safes);
      setError(null);
      return;
    }

    const nowMs = Date.now();
    if (retryAfter > nowMs) {
      const errorMsg = `Rate limited. Please retry after ${Math.round((retryAfter - nowMs) / 1000)}s`;
      console.log('[useOwnerSafes]', errorMsg);
      setError(errorMsg);
      return;
    }

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
      setSafes(normalizedSafes);
      setError(null);

      // Update cache
      cacheRef.current.set(normalizedWallet, {
        safes: normalizedSafes,
        timestamp: Date.now(),
      });
    } catch (err) {
      console.error('[useOwnerSafes] Error:', err);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Không thể lấy danh sách Safe từ API");
      }
      setSafes([]);
    } finally {
      setIsLoading(false);
    }
  }, [normalizedWallet]);

  useEffect(() => {
    if (normalizedWallet && /^0x[a-f0-9]{40}$/.test(normalizedWallet)) {
      fetchOwnerSafes();
    } else {
      setSafes([]);
      setError(null);
      // Clear cache for invalid wallet
      if (normalizedWallet) {
        cacheRef.current.delete(normalizedWallet);
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
