'use client';

import { useEffect, useState } from 'react';
import { useCallback } from 'react';
import type {
  CampaignRecord,
  DonationRecord,
  PaginatedResponseMeta,
  TransactionRecord,
} from '@/lib/api/types';
import { getCampaignById, getCampaigns, getDonationsByWallet, getTransactionsByWallet } from '@/lib';
import { useAuth } from '@/lib';

/**
 * Shared async state shape used by backend data hooks.
 */
type QueryState<T> = {
  data: T;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
};

type PaginatedQueryState<T> = QueryState<T[]> & {
  meta: PaginatedResponseMeta;
};

const EMPTY_PAGINATION_META: PaginatedResponseMeta = {
  totalItems: 0,
  totalPages: 0,
  currentPage: 1,
};

export function useBackendCampaigns(): QueryState<CampaignRecord[]> {
  const [data, setData] = useState<CampaignRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      setData(await getCampaigns());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể tải campaign từ backend');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, isLoading, error, refetch: fetchData };
}

export function useBackendCampaign(id: number | null): QueryState<CampaignRecord | null> {
  const [data, setData] = useState<CampaignRecord | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!id) return;
    try {
      setIsLoading(true);
      setError(null);
      setData(await getCampaignById(id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể tải chi tiết campaign');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, isLoading, error, refetch: fetchData };
}

export function useBackendDonations(wallet: string | null): QueryState<DonationRecord[]> {
  const [data, setData] = useState<DonationRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!wallet) {
      setData([]);
      return;
    }
    try {
      setIsLoading(true);
      setError(null);
      setData(await getDonationsByWallet(wallet));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể tải donation');
    } finally {
      setIsLoading(false);
    }
  }, [wallet]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, isLoading, error, refetch: fetchData };
}

export function useBackendTransactions(
  wallet: string | null,
  page = 1,
  limit = 10
): PaginatedQueryState<TransactionRecord> {
  const { token } = useAuth();
  const [data, setData] = useState<TransactionRecord[]>([]);
  const [meta, setMeta] = useState<PaginatedResponseMeta>(EMPTY_PAGINATION_META);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!wallet) {
      setData([]);
      setMeta(EMPTY_PAGINATION_META);
      return;
    }
    try {
      setIsLoading(true);
      setError(null);
      const response = await getTransactionsByWallet(token, wallet, page, limit);
      setData(response.data);
      setMeta(response.meta);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load transactions');
    } finally {
      setIsLoading(false);
    }
  }, [token, wallet, page, limit]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, meta, isLoading, error, refetch: fetchData };
}
