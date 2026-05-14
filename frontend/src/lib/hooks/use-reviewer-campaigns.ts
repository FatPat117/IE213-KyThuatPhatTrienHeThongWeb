"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useOwnerSafes } from "./use-owner-safes";
import { useReadReviewerSafesOnChain } from "@/lib";
import { getPublicCampaigns, getPublicCampaignMilestones, invalidatePublicCampaignsCache, invalidatePublicMilestonesCache } from "@/lib/api/campaigns";

interface ReviewerCampaignRow {
  campaign: {
    onChainId: number;
    title: string;
    description: string;
    creator: string;
    reviewerSafe: string;
    goalWei: string;
    totalRaisedWei: string;
    totalDisbursedWei: string;
    deadline: string;
    status: string;
    milestoneCount: number;
    thumbnailUrl: string;
    createdAt: string;
  };
  milestones: Array<{
    milestoneId: number;
    title: string;
    description: string;
    allocationBps: number;
    amountWei: string;
    deadline: string;
    status: string;
    reportCids: Array<{ cid: string; submittedAt: string }>;
    approvedAt: string | null;
    approvedBy: string;
    disbursedAt: string | null;
    lastRejectionReason?: string;
    rejectionCount?: number;
    maxRetries?: number;
    pendingRejections?: number;
    rejectionVoters?: string[];
  }>;
}

const CLEARLY_PENDING_STATUSES = new Set([
  "submitted",
  "pending_verification",
  "resubmittable",
]);

const CLEARLY_DONE_STATUSES = new Set([
  "failed",
  "refunded",
  "review_timeout",
  "deadline_exceeded",
]);

function isMilestoneNeedingReview(milestone: { status: string; approvedAt: string | null; disbursedAt: string | null }): boolean {
  if (CLEARLY_PENDING_STATUSES.has(milestone.status)) return true;
  if (milestone.status === "disbursed" && !milestone.approvedAt) return true;
  return false;
}

function isMilestoneFullyCompleted(milestone: { status: string; approvedAt: string | null; disbursedAt: string | null }): boolean {
  if (CLEARLY_DONE_STATUSES.has(milestone.status)) return true;
  if (milestone.status === "approved") return true;
  if (milestone.status === "disbursed" && Boolean(milestone.approvedAt)) return true;
  return false;
}

function getMilestoneActivityTimestamp(milestone: {
  milestoneId: number;
  reportCids: Array<{ submittedAt: string }>;
  approvedAt: string | null;
  disbursedAt: string | null;
  deadline: string;
}): number {
  const reportTimestamp = milestone.reportCids.reduce((latest, item) => {
    const timestamp = new Date(item.submittedAt).getTime();
    if (Number.isNaN(timestamp)) return latest;
    return Math.max(latest, timestamp);
  }, 0);
  const approvedTimestamp = milestone.approvedAt
    ? new Date(milestone.approvedAt).getTime()
    : 0;
  const disbursedTimestamp = milestone.disbursedAt
    ? new Date(milestone.disbursedAt).getTime()
    : 0;
  const deadlineTimestamp = new Date(milestone.deadline).getTime();
  return Math.max(
    reportTimestamp,
    Number.isNaN(approvedTimestamp) ? 0 : approvedTimestamp,
    Number.isNaN(disbursedTimestamp) ? 0 : disbursedTimestamp,
    Number.isNaN(deadlineTimestamp) ? 0 : deadlineTimestamp,
    milestone.milestoneId,
  );
}

function getCampaignSortTimestamp(row: ReviewerCampaignRow): number {
  const latestMilestoneTimestamp = row.milestones.reduce(
    (latest, milestone) => Math.max(latest, getMilestoneActivityTimestamp(milestone)),
    0,
  );
  if (latestMilestoneTimestamp > 0) return latestMilestoneTimestamp;
  const createdAt = new Date(row.campaign.createdAt).getTime();
  return Number.isNaN(createdAt) ? 0 : createdAt;
}

function sortReviewerRows(rows: ReviewerCampaignRow[]) {
  return [...rows].sort((a, b) => {
    const diff = getCampaignSortTimestamp(b) - getCampaignSortTimestamp(a);
    if (diff !== 0) return diff;
    return b.campaign.onChainId - a.campaign.onChainId;
  });
}

export function useReviewerCampaigns() {
  const { safes: ownerSafes, isLoading: isLoadingOwnerSafes } = useOwnerSafes();
  const { reviewerSafes: registeredSafes, isLoading: isLoadingRegistered } = useReadReviewerSafesOnChain();

  // Compute reviewer safes: intersection of owner's safes and registered safes
  const myReviewerSafes = useMemo(() => {
    if (!ownerSafes.length || !registeredSafes.length) return [];
    return ownerSafes.filter((safe) => registeredSafes.includes(safe));
  }, [ownerSafes, registeredSafes]);

  const [rows, setRows] = useState<ReviewerCampaignRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);

  const fetchCampaignsForSafe = useCallback(async (safe: string) => {
    const response = await getPublicCampaigns({
      reviewerSafe: safe,
      sort: "updatedAt",
      order: "desc",
    });

    const campaigns = response.items.filter((campaign) => {
      const campaignSafe = (campaign.reviewerSafe || "").trim().toLowerCase();
      return campaignSafe === safe;
    });

    return campaigns;
  }, []);

  const fetchMilestonesForCampaign = useCallback(async (onChainId: number) => {
    const response = await getPublicCampaignMilestones(onChainId);
    const pendingMilestones = response.milestones.filter(isMilestoneNeedingReview);
    const processedMilestones = response.milestones.filter(isMilestoneFullyCompleted);

    pendingMilestones.sort(
      (a, b) => getMilestoneActivityTimestamp(b) - getMilestoneActivityTimestamp(a),
    );
    processedMilestones.sort(
      (a, b) => getMilestoneActivityTimestamp(b) - getMilestoneActivityTimestamp(a),
    );

    return {
      campaignOnChainId: onChainId,
      pendingMilestones,
      processedMilestones,
    };
  }, []);

  const refresh = useCallback(async (force = false) => {
    if (myReviewerSafes.length === 0) {
      setRows([]);
      setLastUpdatedAt(new Date().toLocaleTimeString("vi-VN"));
      return;
    }

    if (force) {
        invalidatePublicCampaignsCache();
        invalidatePublicMilestonesCache();
    }

    setIsLoading(true);
    setError(null);

    try {
      // Fetch campaigns for all reviewer safes in parallel
      const campaignsPromises = myReviewerSafes.map(fetchCampaignsForSafe);
      const campaignsResults = await Promise.allSettled(campaignsPromises);

      // Collect all campaigns
      const allCampaigns: Array<{
        campaign: any;
        safe: string;
      }> = [];

      campaignsResults.forEach((result, index) => {
        if (result.status === "fulfilled") {
          const safe = myReviewerSafes[index];
          result.value.forEach((campaign: any) => {
            allCampaigns.push({ campaign, safe });
          });
        }
      });

      // Remove duplicate campaigns (same onChainId)
      const uniqueCampaigns = new Map<number, typeof allCampaigns[0]>();
      allCampaigns.forEach((item) => {
        if (!uniqueCampaigns.has(item.campaign.onChainId)) {
          uniqueCampaigns.set(item.campaign.onChainId, item);
        }
      });

      const campaignIds = Array.from(uniqueCampaigns.keys()).sort((a, b) => a - b);

      // Fetch milestones for each campaign in parallel
      const milestonesPromises = campaignIds.map(fetchMilestonesForCampaign);
      const milestonesResults = await Promise.allSettled(milestonesPromises);

      const nextRows: ReviewerCampaignRow[] = [];
      milestonesResults.forEach((result, index) => {
        if (result.status !== "fulfilled") return;

        const campaignId = campaignIds[index];
        const campaignItem = uniqueCampaigns.get(campaignId);
        if (!campaignItem) return;

        const { pendingMilestones, processedMilestones } = result.value;

        // Luôn bao gồm campaign được giao cho reviewer, kể cả chưa có milestone nào cần duyệt
        // (ví dụ: campaign mới tạo, chờ funding, chưa có milestone ở trạng thái pending)
        nextRows.push({
          campaign: campaignItem.campaign,
          milestones: [...pendingMilestones, ...processedMilestones].sort(
            (a, b) => getMilestoneActivityTimestamp(b) - getMilestoneActivityTimestamp(a),
          ),
        });
      });

      const sortedRows = sortReviewerRows(nextRows);
      setRows(sortedRows);
      setLastUpdatedAt(new Date().toLocaleTimeString("vi-VN"));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Không thể tải danh sách chiến dịch reviewer",
      );
    } finally {
      setIsLoading(false);
    }
  }, [myReviewerSafes, fetchCampaignsForSafe, fetchMilestonesForCampaign]);

  useEffect(() => {
    if (!isLoadingOwnerSafes && !isLoadingRegistered && myReviewerSafes.length > 0) {
      refresh(true);
    } else if (myReviewerSafes.length === 0) {
      setRows([]);
      setLastUpdatedAt(new Date().toLocaleTimeString("vi-VN"));
    }
  }, [myReviewerSafes, refresh, isLoadingOwnerSafes, isLoadingRegistered]);

  // Auto-refresh every 60 seconds (increased from 20s to prevent 429)
  useEffect(() => {
    if (myReviewerSafes.length === 0) return;
    const timer = window.setInterval(() => {
      // Use background refresh without forcing cache invalidation
      refresh(false);
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [refresh, myReviewerSafes.length]);

  return {
    rows,
    myReviewerSafes,
    isLoading: isLoadingOwnerSafes || isLoadingRegistered || isLoading,
    error,
    lastUpdatedAt,
    refresh,
  };
}
