'use client';

import { apiRequest } from './client';
import type { AuthUser } from './types';

const USER_PROFILE_CACHE_TTL_MS = 5 * 60 * 1000;
const userProfileCache = new Map<
  string,
  {
    expiresAt: number;
    data: {
      walletAddress: string;
      displayName?: string;
      avatarUrl?: string;
      role: 'user' | 'admin' | 'guest';
    } | null;
  }
>();
const userProfileInFlight = new Map<
  string,
  Promise<{
    walletAddress: string;
    displayName?: string;
    avatarUrl?: string;
    role: 'user' | 'admin' | 'guest';
  } | null>
>();

export async function getUserProfile(wallet: string) {
  const normalizedWallet = wallet.trim().toLowerCase();
  const now = Date.now();
  const cached = userProfileCache.get(normalizedWallet);
  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  const inFlight = userProfileInFlight.get(normalizedWallet);
  if (inFlight) {
    return inFlight;
  }

  const request = (async () => {
    try {
      const data = await apiRequest<{
        walletAddress: string;
        displayName?: string;
        avatarUrl?: string;
        role: 'user' | 'admin' | 'guest';
      }>(`/users/${normalizedWallet}`);
      userProfileCache.set(normalizedWallet, {
        data,
        expiresAt: Date.now() + USER_PROFILE_CACHE_TTL_MS,
      });
      return data;
    } catch (error) {
      const message = error instanceof Error ? error.message.toLowerCase() : '';
      // Cache "not found" temporarily to stop repeated 404 calls for same wallet.
      if (message.includes('not found') || message.includes('404')) {
        userProfileCache.set(normalizedWallet, {
          data: null,
          expiresAt: Date.now() + USER_PROFILE_CACHE_TTL_MS,
        });
        return null;
      }
      throw error;
    } finally {
      userProfileInFlight.delete(normalizedWallet);
    }
  })();

  userProfileInFlight.set(normalizedWallet, request);
  return request;
}

export async function updateUserProfile(
  token: string | null,
  wallet: string,
  updates: { displayName?: string; avatarUrl?: string }
) {
  return apiRequest<{
    walletAddress: string;
    displayName?: string;
    avatarUrl?: string;
    role: 'user' | 'admin' | 'guest';
  }>(`/users/${wallet}`, {
    method: 'PUT',
    token,
    body: JSON.stringify(updates),
  });
}

export function toAuthUserProfile(input: {
  walletAddress: string;
  role: 'user' | 'admin' | 'guest';
  displayName?: string;
  avatarUrl?: string;
}): AuthUser {
  return {
    wallet: input.walletAddress,
    role: input.role === 'admin' ? 'admin' : 'user',
    displayName: input.displayName || '',
    avatarUrl: input.avatarUrl || '',
  };
}
