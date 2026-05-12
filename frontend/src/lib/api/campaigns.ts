"use client";

import { API_BASE_URL, apiRequest, trackedFetch } from "./client";
import type { CampaignRecord } from "./types";

export interface PublicCampaignItem {
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
    lastRejectionReason?: string;
    rejectionCount?: number;
    maxRetries?: number;
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

export interface RefundStatusResponse {
    status: "none" | "eligible" | "prepared" | "refunded";
    refundedWei: string;
    eligibleRefundWei: string;
    refundedAt: string | null;
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

export interface PublicCampaignMilestonesResponse {
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
    lastRejectionReason?: string;
    rejectionCount?: number;
    maxRetries?: number;
}

interface MilestoneServiceResponse {
    success?: boolean;
    status?: "success" | "error";
    data?: CampaignMilestoneRecord[];
    error?: string;
    message?: string;
}

export const TERMINAL_STATUSES = new Set([
    "completed",
    "failed",
    "cancelled",
    "closed",
    "refunded",
    "success",
]);

// Global cache configuration
const PUBLIC_CAMPAIGNS_CACHE_TTL_MS = 300_000; // 5 minutes
const PUBLIC_MILESTONES_CACHE_TTL_MS = 300_000; // 5 minutes
const AGGREGATES_CACHE_TTL_MS = 600_000; // 10 minutes
const CAMPAIGN_INDEX_STATUS_CACHE_TTL_MS = 60_000; // 1 minute
const DISBURSED_MILESTONE_COUNT_CACHE_TTL_MS = 600_000; 

const publicCampaignsCache = new Map<string, { data: PublicCampaignsResponse; expiresAt: number }>();
const publicCampaignsInFlight = new Map<string, Promise<PublicCampaignsResponse>>();
const publicMilestonesCache = new Map<number, { data: PublicCampaignMilestonesResponse; expiresAt: number }>();
const publicMilestonesInFlight = new Map<number, Promise<PublicCampaignMilestonesResponse>>();
let allPublicCampaignsCache: { data: PublicCampaignItem[]; expiresAt: number } | null = null;
let allPublicCampaignsInFlight: Promise<PublicCampaignItem[]> | null = null;

const campaignIndexStatusCache = new Map<number, { indexed: boolean; expiresAt: number }>();

let reviewerAggregatesCache: { data: ReviewerAggregate[]; expiresAt: number } | null = null;
let reviewerAggregatesInFlight: Promise<ReviewerAggregate[]> | null = null;
let disbursedMilestoneCountCache: { value: number; expiresAt: number } | null = null;
let disbursedMilestoneCountInFlight: Promise<number> | null = null;

export function invalidatePublicCampaignsCache() {
    publicCampaignsCache.clear();
    allPublicCampaignsCache = null;
}

export function invalidatePublicMilestonesCache() {
    publicMilestonesCache.clear();
}

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
        throw new Error("Chiến dịch chưa được index.");
    }
}

export function mapMilestoneRecord(
    item: CampaignMilestoneRecord | any,
): PublicCampaignMilestone {
    return {
        milestoneId: Number(item.milestoneId ?? item.milestoneIndex ?? 0),
        title: item.title || "",
        description: item.description || "",
        allocationBps: Number(item.allocationBps || 0),
        amountWei: (
            item.financialTargetWei ||
            item.amountWei ||
            "0"
        ).toString(),
        deadline: item.deadline || "",
        status: item.status || "pending_funding",
        reportCids: (() => {
            if (!Array.isArray(item.reportCids)) return [];
            const seenCids = new Set<string>();
            return item.reportCids
                .filter((entry: { cid: string; submittedAt: string }) => {
                    const cid = (entry?.cid || "").trim();
                    if (!cid || seenCids.has(cid)) return false;
                    seenCids.add(cid);
                    return true;
                })
                .map((entry: { cid: string; submittedAt: string }) => ({
                    cid: (entry.cid || "").trim(),
                    submittedAt: entry.submittedAt || "",
                }));
        })(),
        approvedAt: item.approvedAt || null,
        approvedBy: item.approvedBy || "",
        disbursedAt: item.disbursedAt || null,
        lastRejectionReason: item.lastRejectionReason,
        rejectionCount: typeof (item as Record<string, unknown>).rejectionCount === 'number'
            ? (item as Record<string, unknown>).rejectionCount as number
            : undefined,
        maxRetries: typeof (item as Record<string, unknown>).maxRetries === 'number'
            ? (item as Record<string, unknown>).maxRetries as number
            : undefined,
    };
}

async function getAllPublicCampaigns(): Promise<PublicCampaignItem[]> {
    if (allPublicCampaignsCache && Date.now() <= allPublicCampaignsCache.expiresAt) {
        return allPublicCampaignsCache.data;
    }
    if (allPublicCampaignsInFlight) return allPublicCampaignsInFlight;

    allPublicCampaignsInFlight = (async () => {
        const allItems: PublicCampaignItem[] = [];
        let page = 1;
        let totalPages = 1;

        do {
            const response = await getPublicCampaigns({ page, limit: 100 });
            allItems.push(...response.items);
            totalPages = response.pagination.totalPages;
            page += 1;
        } while (page <= totalPages);

        allPublicCampaignsCache = {
            data: allItems,
            expiresAt: Date.now() + PUBLIC_CAMPAIGNS_CACHE_TTL_MS
        };
        return allItems;
    })();

    try {
        return await allPublicCampaignsInFlight;
    } finally {
        allPublicCampaignsInFlight = null;
    }
}

export interface PaginatedCampaignsResponse {
    campaigns: CampaignRecord[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

export async function getCampaigns(params?: {
    page?: number;
    limit?: number;
    status?: string;
    creator?: string;
}) {
    const query = new URLSearchParams();
    if (params?.page) query.set("page", String(params.page));
    if (params?.limit) query.set("limit", String(params.limit));
    if (params?.status) query.set("status", params.status);
    if (params?.creator) query.set("creator", params.creator);

    const suffix = query.toString() ? `?${query.toString()}` : "";
    return apiRequest<PaginatedCampaignsResponse>(`/campaigns${suffix}`);
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

export async function updateCampaignStatus(
    id: number,
    token: string,
    status:
        | "pending_approval"
        | "active"
        | "in_progress"
        | "completed"
        | "partial_failed"
        | "failed"
        | "cancelled",
) {
    return apiRequest<CampaignRecord>(`/campaigns/${id}/status`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ status }),
    });
}

export async function rejectCampaign(
    id: number,
    token: string,
    reason: string,
) {
    return apiRequest<{
        campaignOnChainId: number;
        campaignStatus: string;
        reason: string;
    }>(`/campaigns/${id}/reject`, {
        method: "POST",
        token,
        body: JSON.stringify({ reason }),
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
    const cacheKey = `/campaigns/public/campaigns${suffix}`;

    const cached = publicCampaignsCache.get(cacheKey);
    if (cached && Date.now() <= cached.expiresAt) return cached.data;

    const inFlight = publicCampaignsInFlight.get(cacheKey);
    if (inFlight) return inFlight;

    const task = apiRequest<PublicCampaignsResponse>(cacheKey).then(data => {
        publicCampaignsCache.set(cacheKey, {
            data,
            expiresAt: Date.now() + PUBLIC_CAMPAIGNS_CACHE_TTL_MS
        });
        return data;
    }).finally(() => {
        publicCampaignsInFlight.delete(cacheKey);
    });

    publicCampaignsInFlight.set(cacheKey, task);
    return task;
}

export async function getPublicStats() {
    return apiRequest<PublicStatsResponse>("/campaigns/public/stats");
}

export async function getPublicCampaignMilestones(
    onChainId: number,
): Promise<PublicCampaignMilestonesResponse> {
    const normalizedId = Number(onChainId);
    if (!Number.isFinite(normalizedId)) {
        throw new Error("Invalid campaign id");
    }
    const cached = publicMilestonesCache.get(normalizedId);
    if (cached && Date.now() <= cached.expiresAt) {
        return cached.data;
    }
    const pending = publicMilestonesInFlight.get(normalizedId);
    if (pending) {
        return pending;
    }

    const run = async () => {
    try {
        await ensureCampaignIndexed(normalizedId);
        // Prefer public campaign endpoint to avoid protected milestone route issues
        // in guest sessions and keep response shape consistent.
        const data = await apiRequest<PublicCampaignMilestonesResponse>(
            `/campaigns/public/campaigns/${normalizedId}/milestones`,
            { timeoutMs: 7000 },
        );
        publicMilestonesCache.set(normalizedId, {
            data,
            expiresAt: Date.now() + PUBLIC_MILESTONES_CACHE_TTL_MS,
        });
        return data;
    } catch (error) {
        const message =
            error instanceof Error ? error.message.toLowerCase() : "";
        if (
            message.includes("not yet indexed") ||
            message.includes("chưa được index")
        ) {
            // Indexing can lag right after on-chain creation.
            // Fall back to campaign-service public milestone endpoint,
            // then let caller decide fallback timeline if this still fails.
        }

        // Backward compatible fallback for environments that still expose
        // milestone timeline via milestone-service endpoint.
        const response = await trackedFetch(
            `${API_BASE_URL}/milestones/campaigns/${normalizedId}`,
            {
                cache: "no-store",
                headers: {
                    "Cache-Control": "no-cache",
                    Pragma: "no-cache",
                },
            },
            `/milestones/campaigns/${normalizedId}`,
        );
        const payload = (await response.json()) as MilestoneServiceResponse;
        if (!response.ok || payload.status !== "success") {
            throw new Error(payload.error || payload.message || "Request failed");
        }
        const rawMilestones = Array.isArray(payload.data) ? payload.data : [];
        const data = {
            campaignOnChainId: normalizedId,
            milestones: rawMilestones.map(mapMilestoneRecord),
        };
        publicMilestonesCache.set(normalizedId, {
            data,
            expiresAt: Date.now() + PUBLIC_MILESTONES_CACHE_TTL_MS,
        });
        return data;
    }
    };

    const task = run().finally(() => {
        publicMilestonesInFlight.delete(normalizedId);
    });
    publicMilestonesInFlight.set(normalizedId, task);
    return task;
}

export async function getMilestoneApprovalStatus(
    onChainId: number,
    milestoneId: number,
    token: string,
    refresh = false,
) {
    const query = refresh ? "?refresh=true" : "";
    return apiRequest<MilestoneApprovalStatus>(
        `/campaigns/${onChainId}/milestones/${milestoneId}/approval-status${query}`,
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
    if (disbursedMilestoneCountCache && Date.now() <= disbursedMilestoneCountCache.expiresAt) {
        return disbursedMilestoneCountCache.value;
    }
    if (disbursedMilestoneCountInFlight) return disbursedMilestoneCountInFlight;

    disbursedMilestoneCountInFlight = (async () => {
        try {
            // Tạm thời trả về 0 hoặc lấy từ Stats tập trung thay vì quét từng campaign
            // Việc quét 100 campaign ở frontend là sai lầm về kiến trúc.
            return 0; 
        } catch {
            return 0;
        }
    })();

    try {
        const result = await disbursedMilestoneCountInFlight;
        disbursedMilestoneCountCache = { value: result, expiresAt: Date.now() + DISBURSED_MILESTONE_COUNT_CACHE_TTL_MS };
        return result;
    } finally {
        disbursedMilestoneCountInFlight = null;
    }
}

export async function getReviewerAggregates(): Promise<ReviewerAggregate[]> {
    if (reviewerAggregatesCache && Date.now() <= reviewerAggregatesCache.expiresAt) {
        return reviewerAggregatesCache.data;
    }
    if (reviewerAggregatesInFlight) return reviewerAggregatesInFlight;

    reviewerAggregatesInFlight = (async () => {
        // Thay vì quét toàn bộ campaign, chúng ta sẽ trả về mảng trống hoặc 
        // lấy từ một API endpoint tổng hợp duy nhất (nếu có).
        // KHÔNG ĐƯỢC quét N+1 API ở đây.
        return [];
    })();

    try {
        const result = await reviewerAggregatesInFlight;
        reviewerAggregatesCache = { data: result, expiresAt: Date.now() + AGGREGATES_CACHE_TTL_MS };
        return result;
    } finally {
        reviewerAggregatesInFlight = null;
    }
}

export async function getRefundStatus(
    onChainId: number,
    address: string,
): Promise<RefundStatusResponse> {
    const response = await apiRequest<{
        success: boolean;
        data: RefundStatusResponse;
    }>(`/campaigns/public/campaigns/${onChainId}/refund-status?address=${encodeURIComponent(address)}`);
    if (!response.success || !response.data) {
        throw new Error("Không thể lấy trạng thái hoàn tiền.");
    }
    return response.data;
}
