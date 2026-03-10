'use client';

import { apiRequest } from './client';
import type { AuthUser } from './types';

export async function requestNonce(wallet: string) {
  return apiRequest<{ nonce: string; wallet: string }>('/auth/nonce', {
    method: 'POST',
    body: JSON.stringify({ wallet }),
  });
}

export async function verifyWalletSignature(wallet: string, signature: string) {
  return apiRequest<{ token: string; user: AuthUser }>('/auth/verify', {
    method: 'POST',
    body: JSON.stringify({ wallet, signature }),
  });
}

export async function refreshAuthToken(token: string) {
  return apiRequest<{ token: string; user: AuthUser }>('/auth/refresh', {
    method: 'POST',
    token,
  });
}
