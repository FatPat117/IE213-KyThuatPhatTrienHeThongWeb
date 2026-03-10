'use client';

import { useEffect, useState } from 'react';
import { useCallback } from 'react';
import type { CampaignRecord, DonationRecord, TransactionRecord } from '@/lib/api/types';
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

export function useBackendTransactions(wallet: string | null): QueryState<TransactionRecord[]> {
  const { token } = useAuth();
  const [data, setData] = useState<TransactionRecord[]>([]);
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
      setData(await getTransactionsByWallet(token, wallet));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể tải transaction');
    } finally {
      setIsLoading(false);
    }
  }, [token, wallet]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, isLoading, error, refetch: fetchData };
}
