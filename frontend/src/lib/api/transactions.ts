'use client';

import { apiRequest } from './client';
import type { TransactionRecord } from './types';

export async function createTransaction(
  token: string | null,
  payload: { txHash: string; walletAddress: string; action: 'donate' | 'createCampaign' | 'mintNFT'; campaignOnChainId?: number }
) {
  return apiRequest<TransactionRecord>('/transactions', {
    method: 'POST',
    token,
    body: JSON.stringify(payload),
  });
}

export async function getTransactionsByWallet(token: string | null, wallet: string) {
  return apiRequest<TransactionRecord[]>(`/transactions/${wallet}`, {
    token,
  });
}
