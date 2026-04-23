"use client";

import { useEffect, useState } from "react";
import { useCallback } from "react";
import type {
    CampaignRecord,
    DonationRecord,
    TransactionRecord,
} from "@/lib/api/types";
import {
    getCampaignById,
    getCampaigns,
    getDonationsByCampaignAndWallet,
    getDonationsByWallet,
    getTransactionsByWallet,
} from "@/lib";
import { getPublicStats, type PublicStatsResponse } from "@/lib/api/campaigns";
import { useAuth } from "@/lib";
import { getBackendErrorMessage } from "@/lib/errors/normalize";

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
            setError(
                getBackendErrorMessage(err, {
                    fallback:
                        "Không thể tải danh sách chiến dịch. Vui lòng thử lại.",
                }),
            );
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    return { data, isLoading, error, refetch: fetchData };
}

export function useBackendCampaign(
    id: number | null,
): QueryState<CampaignRecord | null> {
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
            setError(
                getBackendErrorMessage(err, {
                    fallback:
                        "Không thể tải chi tiết chiến dịch. Vui lòng thử lại.",
                }),
            );
        } finally {
            setIsLoading(false);
        }
    }, [id]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    return { data, isLoading, error, refetch: fetchData };
}

export function useBackendDonations(
    wallet: string | null,
    campaignId?: number | null,
): QueryState<DonationRecord[]> {
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
            if (Number.isFinite(campaignId)) {
                setData(
                    await getDonationsByCampaignAndWallet(
                        Number(campaignId),
                        wallet,
                    ),
                );
                return;
            }
            setData(await getDonationsByWallet(wallet));
        } catch (err) {
            setError(
                getBackendErrorMessage(err, {
                    fallback:
                        "Không thể tải danh sách quyên góp. Vui lòng thử lại.",
                }),
            );
        } finally {
            setIsLoading(false);
        }
    }, [campaignId, wallet]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    return { data, isLoading, error, refetch: fetchData };
}

export function useBackendTransactions(
    wallet: string | null,
): QueryState<TransactionRecord[]> {
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
            setError(
                getBackendErrorMessage(err, {
                    fallback: "Không thể tải giao dịch. Vui lòng thử lại.",
                }),
            );
        } finally {
            setIsLoading(false);
        }
    }, [token, wallet]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    return { data, isLoading, error, refetch: fetchData };
}

export function usePublicStats(): QueryState<PublicStatsResponse | null> {
    const [data, setData] = useState<PublicStatsResponse | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        try {
            setIsLoading(true);
            setError(null);
            setData(await getPublicStats());
        } catch (err) {
            setError(
                getBackendErrorMessage(err, {
                    fallback: "Không thể tải thống kê công khai.",
                }),
            );
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    return { data, isLoading, error, refetch: fetchData };
}
