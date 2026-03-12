'use client';

import { apiRequest } from './client';
import type { AuthUser } from './types';

export async function getUserProfile(wallet: string) {
  return apiRequest<{
    walletAddress: string;
    displayName?: string;
    avatarUrl?: string;
    role: 'user' | 'admin' | 'guest';
  }>(`/users/${wallet}`);
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
