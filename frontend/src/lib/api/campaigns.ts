"use client";

import { API_BASE_URL, apiRequest } from "./client";
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

interface CampaignMilestoneRecord {
    milestoneId?: number;
    milestoneIndex?: number;
    title?: string;
    description?: string;
    allocationBps?: number;
    financialTargetWei?: string;
    amountWei?: string;
    deadline?: string;
    status?: string;
    reportCids?: Array<{ cid?: string; submittedAt?: string }>;
    approvedAt?: string | null;
    approvedBy?: string;
    disbursedAt?: string | null;
}

interface MilestoneServiceResponse {
    success?: boolean;
    status?: "success" | "error";
    data?: CampaignMilestoneRecord[];
    error?: string;
    message?: string;
}

const CAMPAIGN_INDEX_STATUS_CACHE_TTL_MS = 15_000;
const campaignIndexStatusCache = new Map<
    number,
    { indexed: boolean; expiresAt: number }
>();

function readCachedCampaignIndexStatus(id: number): boolean | null {
    const cached = campaignIndexStatusCache.get(id);
    if (!cached) return null;

    if (Date.now() > cached.expiresAt) {
        campaignIndexStatusCache.delete(id);
        return null;
    }

    return cached.indexed;
}

function writeCampaignIndexStatusCache(id: number, indexed: boolean) {
    campaignIndexStatusCache.set(id, {
        indexed,
        expiresAt: Date.now() + CAMPAIGN_INDEX_STATUS_CACHE_TTL_MS,
    });
}

async function ensureCampaignIndexed(onChainId: number): Promise<void> {
    const status = await getCampaignIndexStatus(onChainId);
    if (!status.indexed) {
            throw new Error("Chiến dịch chưa được index");
    }
}

function mapMilestoneRecord(
    item: CampaignMilestoneRecord,
): PublicCampaignMilestone {
    return {
        milestoneId: Number(item.milestoneId ?? item.milestoneIndex ?? 0),
        title: item.title || "",
        description: item.description || "",
        allocationBps: Number(item.allocationBps || 0),
        amountWei: (item.financialTargetWei || item.amountWei || "0").toString(),
        deadline: item.deadline || "",
        status: item.status || "pending_funding",
        reportCids: Array.isArray(item.reportCids)
            ? item.reportCids
                  .filter(
                      (entry) =>
                          typeof entry?.cid === "string" &&
                          entry.cid.trim().length > 0,
                  )
                  .map((entry) => ({
                      cid: (entry.cid || "").trim(),
                      submittedAt: entry.submittedAt || "",
                  }))
            : [],
        approvedAt: item.approvedAt || null,
        approvedBy: item.approvedBy || "",
        disbursedAt: item.disbursedAt || null,
    };
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
    await ensureCampaignIndexed(id);
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
    const normalizedId = Number(id);
    if (!Number.isFinite(normalizedId)) {
        return { indexed: false };
    }

    const cachedStatus = readCachedCampaignIndexStatus(normalizedId);
    if (cachedStatus !== null) {
        return { indexed: cachedStatus };
    }

    const response = await apiRequest<{ indexed: boolean }>(
        `/campaigns/${normalizedId}/status`,
    );
    writeCampaignIndexStatusCache(normalizedId, Boolean(response.indexed));
    return response;
}

export async function getPublicCampaigns(params?: {
    page?: number;
    limit?: number;
    status?: string;
    reviewerSafe?: string;
    sort?: "createdAt" | "updatedAt" | "deadline";
    order?: "asc" | "desc";
}) {
    const query = new URLSearchParams();
    if (params?.page) query.set("page", String(params.page));
    if (params?.limit) query.set("limit", String(params.limit));
    if (params?.status) query.set("status", params.status);
    if (params?.reviewerSafe) query.set("reviewerSafe", params.reviewerSafe);
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
    await ensureCampaignIndexed(onChainId);

    try {
        const response = await fetch(
            `${API_BASE_URL}/milestones/campaigns/${onChainId}`,
            {
                cache: "no-store",
                headers: {
                    "Cache-Control": "no-cache",
                    Pragma: "no-cache",
                },
            },
        );
        const payload = (await response.json()) as MilestoneServiceResponse;

        if (!response.ok || payload.status !== "success") {
            if (response.status === 404) {
                throw new Error("Chiến dịch chưa được index");
            }
            throw new Error(payload.error || payload.message || "Request failed");
        }

        const rawMilestones = Array.isArray(payload.data) ? payload.data : [];
        return {
            campaignOnChainId: onChainId,
            milestones: rawMilestones.map(mapMilestoneRecord),
        };
    } catch (error) {
        const message =
            error instanceof Error ? error.message.toLowerCase() : "";
        if (
            message.includes("not yet indexed") ||
            message.includes("chưa được index")
        ) {
            throw error;
        }

        // Backward compatible fallback for environments that still expose
        // milestone timeline via campaign public endpoint.
        return apiRequest<PublicCampaignMilestonesResponse>(
            `/campaigns/public/campaigns/${onChainId}/milestones`,
        );
    }
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

export async function rejectMilestone(
    campaignOnChainId: number,
    milestoneId: number,
    token: string,
    reason: string,
) {
    return apiRequest<{
        campaignOnChainId: number;
        milestoneIndex: number;
        milestoneStatus: string;
        retriesLeft?: number;
        reason: string;
    }>(`/milestones/${campaignOnChainId}/${milestoneId}/reject`, {
        method: "POST",
        token,
        body: JSON.stringify({ reason }),
    });
}

export async function resubmitMilestone(
    campaignOnChainId: number,
    milestoneId: number,
    token: string,
    evidenceCid?: string,
) {
    return apiRequest<{
        campaignOnChainId: number;
        milestoneIndex: number;
        milestoneStatus: string;
        evidenceCid?: string;
    }>(`/milestones/${campaignOnChainId}/${milestoneId}/resubmit`, {
        method: "PUT",
        token,
        body: JSON.stringify(evidenceCid ? { evidenceCid } : {}),
    });
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
