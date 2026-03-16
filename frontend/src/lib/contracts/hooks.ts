'use client';

import { useMemo } from 'react';
import { Address, formatEther, parseEther } from 'viem';
import { useReadContract, useReadContracts, useWriteContract } from 'wagmi';
import { CROWDFUNDING_CONTRACT_ADDRESS, contractConfig } from './config';

type CampaignTuple = {
    id: bigint;
    creator: Address;
    beneficiary: Address;
    goal: bigint;
    totalRaised: bigint;
    deadline: bigint;
    withdrawn: boolean;
    status: number;
};

const ZERO = BigInt(0);
const ACTIVE_STATUS = 0;

function normalizeCampaign(raw: Partial<CampaignTuple> | null | undefined) {
    const id = Number(raw?.id ?? 0);
    const status = Number(raw?.status ?? ACTIVE_STATUS);

    return {
        id,
        title: `Campaign #${id}`,
        description: 'Campaign data is stored on-chain without off-chain metadata.',
        creator: (raw?.creator ?? '0x0000000000000000000000000000000000000000') as Address,
        beneficiary: (raw?.beneficiary ?? '0x0000000000000000000000000000000000000000') as Address,
        goal: raw?.goal ?? ZERO,
        raised: raw?.totalRaised ?? ZERO,
        totalRaised: raw?.totalRaised ?? ZERO,
        deadline: Number(raw?.deadline ?? 0),
        withdrawn: Boolean(raw?.withdrawn),
        status,
        completed: status !== ACTIVE_STATUS,
    };
}

/**
 * Hook để đọc tổng số chiến dịch
 * Tự động xử lý caching và refetching
 */
export function useReadCampaignCount() {
    const { data: campaignCount, isLoading, isError, error, refetch } = useReadContract({
        ...contractConfig,
        functionName: 'campaignCount',
        query: {
            staleTime: 30000,
            refetchOnWindowFocus: true,
            refetchOnMount: true,
            enabled: true,
        },
    });

    return {
        count: campaignCount ? Number(campaignCount) : 0,
        isLoading,
        isError,
        error: error?.message || null,
        refetch,
    };
}

/**
 * Hook để đọc tổng ETH quyên góp
 * Trả về giá trị theo ETH (tự động chuyển đổi từ Wei)
 */
export function useReadTotalRaised() {
    const { campaigns, isLoading, isError, error, refetch } = useReadAllCampaigns();
    const totalRaisedWei = useMemo(
        () => campaigns.reduce((sum, campaign) => sum + campaign.raised, ZERO),
        [campaigns]
    );

    return {
        totalRaised: parseFloat(formatEther(totalRaisedWei)),
        totalRaisedWei,
        isLoading,
        isError,
        error,
        refetch,
    };
}

/**
 * Hook để đọc một chiến dịch cụ thể theo ID
 * @param campaignId - ID của chiến dịch cần đọc
 */
export function useReadCampaign(campaignId: number | null | undefined) {
    const { data: campaign, isLoading, isError, error, refetch } = useReadContract({
        ...contractConfig,
        functionName: 'getCampaign',
        args:
            campaignId !== null && campaignId !== undefined && campaignId > 0
                ? [BigInt(campaignId)]
                : undefined,
        query: {
            staleTime: 30000,
            refetchOnWindowFocus: true,
            refetchOnMount: true,
            enabled: campaignId !== null && campaignId !== undefined && campaignId > 0,
        },
    });

    return {
        campaign: campaign ? normalizeCampaign(campaign as CampaignTuple) : null,
        isLoading,
        isError,
        error: error?.message || null,
        refetch,
    };
}

/**
 * Hook để đọc tất cả chiến dịch cùng một lúc
 * Cảnh báo: Có thể tốn kém cho mảng lớn, sử dụng cẩn thận
 */
export function useReadAllCampaigns() {
    const countQuery = useReadCampaignCount();
    const campaignCount = countQuery.count;

    const contracts = useMemo(
        () =>
            Array.from({ length: campaignCount }, (_, i) => ({
                ...contractConfig,
                functionName: 'getCampaign' as const,
                args: [BigInt(i + 1)] as const,
            })),
        [campaignCount]
    );

    const {
        data: campaignsData,
        isLoading: isLoadingCampaigns,
        isError,
        error,
        refetch: refetchCampaigns,
    } = useReadContracts({
        contracts,
        query: {
            staleTime: 60000,
            refetchOnWindowFocus: false,
            refetchOnMount: true,
            enabled:
                CROWDFUNDING_CONTRACT_ADDRESS !== '0x0000000000000000000000000000000000000000' &&
                campaignCount > 0,
        },
    });

    const campaigns = useMemo(() => {
        if (!campaignsData) return [];

        return (campaignsData as Array<{ result?: CampaignTuple } | CampaignTuple>)
            .map((item) => {
                const raw = (item as { result?: CampaignTuple }).result ?? (item as CampaignTuple);
                return raw ? normalizeCampaign(raw) : null;
            })
            .filter((campaign): campaign is NonNullable<typeof campaign> => campaign !== null);
    }, [campaignsData]);

    const refetch = async () => {
        await Promise.all([countQuery.refetch(), refetchCampaigns()]);
    };

    return {
        campaigns,
        count: campaigns.length,
        isLoading: countQuery.isLoading || isLoadingCampaigns,
        isError: countQuery.isError || isError,
        error: error?.message || null,
        refetch,
    };
}

/**
 * Hook để lấy thống kê hợp đồng
 * Kết hợp nhiều hoạt động đọc
 */
export function useContractStats() {
    const campaignCount = useReadCampaignCount();
    const totalRaised = useReadTotalRaised();

    const isLoading = campaignCount.isLoading || totalRaised.isLoading;
    const isError = campaignCount.isError || totalRaised.isError;
    const errors = [campaignCount.error, totalRaised.error].filter((e) => e !== null);

    const refetch = async () => {
        await Promise.all([campaignCount.refetch(), totalRaised.refetch()]);
    };

    return {
        campaignCount: campaignCount.count,
        totalRaised: totalRaised.totalRaised,
        totalRaisedWei: totalRaised.totalRaisedWei,
        isLoading,
        isError,
        errors,
        refetch,
    };
}

/**
 * Hook để đọc chiến dịch được lọc
 * @param isCompleted - Lọc theo trạng thái hoàn thành (tùy chọn)
 */
export function useReadFilteredCampaigns(isCompleted?: boolean) {
    const { campaigns, isLoading, isError, error, refetch } = useReadAllCampaigns();

    const filteredCampaigns =
        isCompleted !== undefined ? campaigns.filter((c) => c.completed === isCompleted) : campaigns;

    return {
        campaigns: filteredCampaigns,
        count: filteredCampaigns.length,
        isLoading,
        isError,
        error,
        refetch,
    };
}

/**
 * Hook để quyên góp ETH cho một chiến dịch
 * @returns write function và transaction state
 */
export function useDonateToCampaign() {
    const { writeContractAsync, data, isPending, error } = useWriteContract();

    const donate = (campaignId: number, amountEth: string) => {
        return writeContractAsync({
            ...contractConfig,
            functionName: 'donate',
            args: [BigInt(campaignId)],
            value: parseEther(amountEth),
        });
    };

    return {
        donate,
        hash: data,
        isPending,
        error,
    };
}

/**
 * Hook để tạo chiến dịch mới
 * @returns write function và transaction state
 */
export function useCreateCampaign() {
    const { writeContract, data, isPending, error } = useWriteContract();

    const createCampaign = (beneficiary: Address, goalEth: string, durationDays: number) => {
        return writeContract({
            ...contractConfig,
            functionName: 'createCampaign',
            args: [beneficiary, parseEther(goalEth), BigInt(durationDays)],
        });
    };

    return {
        createCampaign,
        hash: data,
        isPending,
        error,
    };
}

/**
 * Hook để rút tiền từ chiến dịch (creator only)
 * @returns write function và transaction state
 */
export function useWithdrawFunds() {
    const { writeContract, data, isPending, error } = useWriteContract();

    const withdrawFunds = (campaignId: number) => {
        return writeContract({
            ...contractConfig,
            functionName: 'withdrawFunds',
            args: [BigInt(campaignId)],
        });
    };

    return {
        withdrawFunds,
        hash: data,
        isPending,
        error,
    };
}

/**
 * Hook để hoàn tiền (donor only, nếu campaign thất bại)
 * @returns write function và transaction state
 */
export function useRefundDonation() {
    const { writeContract, data, isPending, error } = useWriteContract();

    const refund = (campaignId: number) => {
        return writeContract({
            ...contractConfig,
            functionName: 'claimRefund',
            args: [BigInt(campaignId)],
        });
    };

    return {
        refund,
        hash: data,
        isPending,
        error,
    };
}

/**
 * Hook để cập nhật campaign thành Failed sau deadline (nếu chưa đạt goal).
 */
export function useMarkAsFailed() {
    const { writeContract, data, isPending, error } = useWriteContract();

    const markAsFailed = (campaignId: number) => {
        return writeContract({
            ...contractConfig,
            functionName: 'markAsFailed',
            args: [BigInt(campaignId)],
        });
    };

    return {
        markAsFailed,
        hash: data,
        isPending,
        error,
    };
}

/**
 * Hook để mint NFT certificate sau khi đã donate.
 */
export function useMintCertificate() {
  const { writeContract, data, isPending, error } = useWriteContract();

  const mintCertificate = (campaignId: number) => {
    return writeContract({
      ...contractConfig,
      functionName: 'mintCertificate',
      args: [BigInt(campaignId)],
    });
  };

  return {
    mintCertificate,
    hash: data,
    isPending,
    error,
  };
}
