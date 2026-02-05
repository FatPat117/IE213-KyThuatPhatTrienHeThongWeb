'use client';

import { useReadContract, useWriteContract } from 'wagmi';
import { formatEther, parseEther } from 'viem';
import { contractConfig, CROWDFUNDING_CONTRACT_ADDRESS } from './config';

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
  const { data: totalRaisedWei, isLoading, isError, error, refetch } = useReadContract({
    ...contractConfig,
    functionName: 'totalRaised',
    query: {
      staleTime: 30000,
      refetchOnWindowFocus: true,
      refetchOnMount: true,
      enabled: true,
    },
  });

  return {
    totalRaised: totalRaisedWei ? parseFloat(formatEther(totalRaisedWei as bigint)) : 0,
    totalRaisedWei: totalRaisedWei ? (totalRaisedWei as bigint) : BigInt(0),
    isLoading,
    isError,
    error: error?.message || null,
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
    args: campaignId !== null && campaignId !== undefined ? [BigInt(campaignId)] : undefined,
    query: {
      staleTime: 30000,
      refetchOnWindowFocus: true,
      refetchOnMount: true,
      enabled: campaignId !== null && campaignId !== undefined,
    },
  });

  return {
    campaign: campaign
      ? {
          id: Number(campaign.id || 0),
          title: campaign.title || '',
          description: (campaign as { description?: string }).description || '',
          creator: campaign.creator || '',
          goal: campaign.goal || BigInt(0),
          raised: campaign.raised || BigInt(0),
          completed: campaign.completed || false,
        }
      : null,
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
  const { data: campaignsData, isLoading, isError, error, refetch } = useReadContract({
    ...contractConfig,
    functionName: 'getAllCampaigns',
    query: {
      staleTime: 60000,
      refetchOnWindowFocus: false,
      refetchOnMount: true,
      enabled: CROWDFUNDING_CONTRACT_ADDRESS !== '0x0000000000000000000000000000000000000000',
    },
  });

  const campaigns = campaignsData
    ? (campaignsData as any[]).map((campaign) => ({
        id: Number(campaign.id || 0),
        title: campaign.title || '',
        description: (campaign as { description?: string }).description || '',
        creator: campaign.creator || '',
        goal: campaign.goal || BigInt(0),
        raised: campaign.raised || BigInt(0),
        completed: campaign.completed || false,
      }))
    : [];

  return {
    campaigns,
    count: campaigns.length,
    isLoading,
    isError,
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
  const { writeContract, data, isPending, error } = useWriteContract();

  const donate = (campaignId: number, amountEth: string) => {
    return writeContract({
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

  const createCampaign = (title: string, description: string, goalEth: string, deadline: number) => {
    return writeContract({
      ...contractConfig,
      functionName: 'createCampaign',
      args: [title, description, parseEther(goalEth), BigInt(deadline)],
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
      functionName: 'refund',
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
