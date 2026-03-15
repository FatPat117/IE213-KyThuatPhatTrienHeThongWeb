'use client';

import { apiRequest } from './client';
import type { CertificateRecord, PaginatedResponse } from './types';

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

export async function getCertificatesByOwner(wallet: string, page = 1, limit = 9) {
  const query = new URLSearchParams({ page: String(page), limit: String(limit) });
  const payload = await apiRequest<PaginatedResponse<CertificateRecord> | LegacyPaginatedResponse<CertificateRecord>>(
    `/certificates/owner/${wallet}?${query.toString()}`
  );

  return normalizePaginatedResponse(payload);
}
