'use client';

import { apiRequest } from './client';
import type { PaginatedResponse, TransactionAction, TransactionRecord } from './types';

type LegacyPaginatedResponse<T> = {
  items: T[];
  totalItems: number;
  totalPages: number;
  currentPage: number;
};

function normalizePaginatedResponse<T>(
  payload: PaginatedResponse<T> | LegacyPaginatedResponse<T>
): PaginatedResponse<T> {
  if ('data' in payload && Array.isArray(payload.data)) {
    return payload;
  }

  return {
    data: payload.items,
    meta: {
      totalItems: payload.totalItems,
      totalPages: payload.totalPages,
      currentPage: payload.currentPage,
    },
  };
}

export async function createTransaction(
  token: string | null,
  payload: { txHash: string; walletAddress: string; action: TransactionAction; campaignOnChainId?: number }
) {
  return apiRequest<TransactionRecord>('/transactions', {
    method: 'POST',
    token,
    body: JSON.stringify(payload),
  });
}

export async function getTransactionsByWallet(token: string | null, wallet: string, page = 1, limit = 10) {
  const query = new URLSearchParams({ page: String(page), limit: String(limit) });
  const payload = await apiRequest<PaginatedResponse<TransactionRecord> | LegacyPaginatedResponse<TransactionRecord>>(
    `/transactions/${wallet}?${query.toString()}`,
    {
    token,
    }
  );

  return normalizePaginatedResponse(payload);
}
