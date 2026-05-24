"use client";

import type { CampaignRecord } from "@/lib/api/types";
import {
    getCampaignMetadataFromCache,
    isPlaceholderCampaignDescription,
    isPlaceholderCampaignTitle,
    isPlaceholderThumbnailUrl,
} from "@/lib/utils/campaign-metadata-cache";
import { TERMINAL_STATUSES } from "@/lib/api/campaigns";

export const BTN_PRIMARY =
    "inline-flex items-center justify-center rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-primary)] disabled:cursor-not-allowed disabled:opacity-50";

export const BTN_GHOST =
    "btn-view-detail inline-flex items-center justify-center rounded-lg px-5 py-2.5 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-primary)] disabled:cursor-not-allowed disabled:opacity-50";

export type CampaignListRowData = {
    id: number;
    title: string;
    description: string;
    creator: string;
    goal: bigint;
    raised: bigint;
    status?: string;
    completed: boolean;
    thumbnailUrl?: string | null;
    deadline?: string | null;
    reviewerSafe?: string | null;
    beneficiary?: string | null;
    milestoneCount?: number;
    createdAt?: string | null;
};

export function shortenWalletAddress(address?: string | null) {
    const value = (address || "").trim();
    if (!value) return "—";
    if (value.length <= 12) return value;
    return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

export function formatCampaignDateTime(value?: string | null) {
    if (!value) return "—";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "—";
    return parsed.toLocaleString("vi-VN", {
        dateStyle: "medium",
        timeStyle: "short",
    });
}

export function normalizeCampaignListItem(
    campaign: CampaignRecord,
): CampaignListRowData {
    const cached = getCampaignMetadataFromCache(campaign.onChainId);
    const status = (campaign.status || "").toLowerCase();

    return {
        id: campaign.onChainId,
        title: !isPlaceholderCampaignTitle(campaign.title, campaign.onChainId)
            ? campaign.title
            : cached?.title || `Chiến dịch #${campaign.onChainId}`,
        description: !isPlaceholderCampaignDescription(campaign.description)
            ? campaign.description
            : cached?.description || "Dữ liệu đang được đồng bộ...",
        creator: campaign.creator,
        goal: BigInt(campaign.goal || "0"),
        raised: BigInt(campaign.raised || "0"),
        status: campaign.status,
        completed: TERMINAL_STATUSES.has(status),
        thumbnailUrl: campaign.thumbnailUrl,
        deadline: campaign.deadline || null,
        reviewerSafe: campaign.reviewerSafe || null,
        beneficiary: campaign.beneficiary || null,
        milestoneCount: campaign.milestoneCount ?? campaign.milestones?.length,
        createdAt: campaign.createdAt || null,
    };
}

export function formatEthAmount(value: number) {
    if (!Number.isFinite(value) || value <= 0) return "0";
    if (value < 0.01) return value.toFixed(4).replace(/\.?0+$/, "");
    return value.toFixed(2);
}

export function resolveCampaignThumbnail(
    campaignId: number,
    thumbnailUrl?: string | null,
): string | null {
    const cached = getCampaignMetadataFromCache(campaignId);
    for (const candidate of [thumbnailUrl, cached?.thumbnailUrl]) {
        const normalized = (candidate || "").trim();
        if (normalized && !isPlaceholderThumbnailUrl(normalized)) {
            return normalized;
        }
    }
    return null;
}

export type CampaignStatusPresentation = {
    label: string;
    badgeClass: string;
    progressBarClass: string;
    isActiveFundraising: boolean;
};

export function getCampaignStatusPresentation(
    status: string | undefined,
    completed: boolean,
): CampaignStatusPresentation {
    const normalizedStatus = (status || "").toLowerCase();
    const isPendingApproval = normalizedStatus === "pending_approval";
    const isInProgress = normalizedStatus === "in_progress";
    const isFailed = [
        "failed",
        "partial_failed",
        "cancelled",
        "refunded",
    ].includes(normalizedStatus);
    const isSuccess =
        completed ||
        normalizedStatus === "completed" ||
        normalizedStatus === "success";
    const isActive =
        normalizedStatus === "active" ||
        (!completed && !isPendingApproval && !isInProgress && !isFailed && !isSuccess);

    let badgeClass =
        "border bg-slate-100 text-slate-700 border-slate-200";
    let progressBarClass = "campaign-progress-fill";
    let label = "Không rõ";

    if (isPendingApproval) {
        badgeClass = "border bg-amber-50 text-amber-700 border-amber-200";
        label = "Chờ duyệt";
    } else if (isFailed) {
        badgeClass = "border bg-red-50 text-red-700 border-red-200";
        label =
            normalizedStatus === "cancelled"
                ? "Bị từ chối"
                : normalizedStatus === "partial_failed"
                  ? "Thất bại một phần"
                  : "Thất bại";
    } else if (isInProgress) {
        badgeClass = "border bg-blue-50 text-blue-700 border-blue-200";
        label = "Đang triển khai";
    } else if (normalizedStatus === "active" || isActive) {
        badgeClass = "border bg-blue-50 text-blue-700 border-blue-200";
        label = "Đang hoạt động";
    } else if (isSuccess) {
        badgeClass = "border bg-green-50 text-green-700 border-green-200";
        label = "Thành công";
    }

    return {
        label,
        badgeClass,
        progressBarClass,
        isActiveFundraising: normalizedStatus === "active",
    };
}
