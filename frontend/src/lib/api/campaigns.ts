"use client";

import { apiRequest } from "./client";
import type { CampaignRecord } from "./types";

export interface PublicCampaignItem {
    onChainId: number;
    title: string;
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
}

export interface PublicCampaignMilestone {
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
}

export interface ReviewerAggregate {
    reviewerSafe: string;
    campaignCount: number;
    totalDisbursedWei: string;
    campaignIds: number[];
}

export interface MilestoneApprovalStatus {
    safeAddress: string;
    required: number;
    confirmed: number;
    executed: boolean;
    signers: string[];
    pendingTxHash: string;
}

export interface PublicStatsResponse {
    totalCampaigns: number;
    activeCampaigns: number;
    inProgressCampaigns: number;
    completedCampaigns: number;
    partialFailedCampaigns: number;
    failedCampaigns: number;
    totalRaisedWei: string;
    totalDisbursedWei: string;
    uniqueDonors: number;
    totalCertificates: number;
    updatedAt: string;
}

interface PublicCampaignsResponse {
    items: PublicCampaignItem[];
    pagination: {
        page: number;
        limit: number;
        totalItems: number;
        totalPages: number;
    };
}

interface PublicCampaignMilestonesResponse {
    campaignOnChainId: number;
    milestones: PublicCampaignMilestone[];
}

async function getAllPublicCampaigns(): Promise<PublicCampaignItem[]> {
    const allItems: PublicCampaignItem[] = [];
    let page = 1;
    let totalPages = 1;

    do {
        const response = await getPublicCampaigns({ page, limit: 100 });
        allItems.push(...response.items);
        totalPages = response.pagination.totalPages;
        page += 1;
    } while (page <= totalPages);

    return allItems;
}

export async function getCampaigns() {
    return apiRequest<CampaignRecord[]>("/campaigns");
}

export async function getCampaignById(id: number) {
    return apiRequest<CampaignRecord>(`/campaigns/${id}`);
}

export async function updateCampaignMetadata(
    id: number,
    token: string,
    updates: {
        title?: string;
        description?: string;
        thumbnailUrl?: string;
        reviewerSafe?: string;
        images?: string[];
        milestones?: Array<{
            milestoneId: number;
            title?: string;
            description?: string;
        }>;
    },
) {
    return apiRequest<CampaignRecord>(`/campaigns/${id}/metadata`, {
        method: "PUT",
        token,
        body: JSON.stringify(updates),
    });
}

export async function getCampaignIndexStatus(id: number) {
    return apiRequest<{ indexed: boolean }>(`/campaigns/${id}/status`);
}

export async function getPublicCampaigns(params?: {
    page?: number;
    limit?: number;
    status?: string;
    sort?: "createdAt" | "updatedAt" | "deadline";
    order?: "asc" | "desc";
}) {
    const query = new URLSearchParams();
    if (params?.page) query.set("page", String(params.page));
    if (params?.limit) query.set("limit", String(params.limit));
    if (params?.status) query.set("status", params.status);
    if (params?.sort) query.set("sort", params.sort);
    if (params?.order) query.set("order", params.order);

    const suffix = query.toString() ? `?${query.toString()}` : "";
    return apiRequest<PublicCampaignsResponse>(
        `/campaigns/public/campaigns${suffix}`,
    );
}

export async function getPublicStats() {
    return apiRequest<PublicStatsResponse>("/campaigns/public/stats");
}

export async function getPublicCampaignMilestones(onChainId: number) {
    return apiRequest<PublicCampaignMilestonesResponse>(
        `/campaigns/public/campaigns/${onChainId}/milestones`,
    );
}

export async function getMilestoneApprovalStatus(
    onChainId: number,
    milestoneId: number,
    token: string,
) {
    return apiRequest<MilestoneApprovalStatus>(
        `/campaigns/${onChainId}/milestones/${milestoneId}/approval-status`,
        { token },
    );
}

export async function getDisbursedMilestoneCount(): Promise<number> {
    const campaigns = await getAllPublicCampaigns();
    if (campaigns.length === 0) return 0;

    const milestoneResults = await Promise.allSettled(
        campaigns.map((campaign) =>
            getPublicCampaignMilestones(campaign.onChainId),
        ),
    );

    let disbursedCount = 0;
    for (const result of milestoneResults) {
        if (result.status !== "fulfilled") continue;
        for (const milestone of result.value.milestones) {
            if (milestone.status === "disbursed") {
                disbursedCount += 1;
            }
        }
    }

    return disbursedCount;
}

export async function getReviewerAggregates(): Promise<ReviewerAggregate[]> {
    const campaigns = await getAllPublicCampaigns();
    const aggregates = new Map<string, ReviewerAggregate>();

    for (const campaign of campaigns) {
        const reviewerSafe = (campaign.reviewerSafe || "").trim().toLowerCase();
        if (!/^0x[a-f0-9]{40}$/.test(reviewerSafe)) continue;

        const existing = aggregates.get(reviewerSafe);
        if (!existing) {
            aggregates.set(reviewerSafe, {
                reviewerSafe,
                campaignCount: 1,
                totalDisbursedWei: campaign.totalDisbursedWei || "0",
                campaignIds: [campaign.onChainId],
            });
            continue;
        }

        existing.campaignCount += 1;
        existing.campaignIds.push(campaign.onChainId);

        try {
            const nextTotal =
                BigInt(existing.totalDisbursedWei || "0") +
                BigInt(campaign.totalDisbursedWei || "0");
            existing.totalDisbursedWei = nextTotal.toString();
        } catch {
            // Ignore malformed wei values from upstream and keep previous aggregate.
        }
    }

    return Array.from(aggregates.values()).sort(
        (a, b) => b.campaignCount - a.campaignCount,
    );
}
