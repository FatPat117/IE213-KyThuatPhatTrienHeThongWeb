"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { formatEther } from "viem";
import { useAccount, useWaitForTransactionReceipt } from "wagmi";
import {
    getMilestoneApprovalStatus,
    getPublicCampaignMilestones,
    getPublicCampaigns,
    rejectMilestone,
    useApproveMilestone,
    useAuth,
} from "@/lib";
import type {
    MilestoneApprovalStatus,
    PublicCampaignItem,
    PublicCampaignMilestone,
} from "@/lib/api/campaigns";
import { useRegisterWalletTxOverlay } from "@/context/wallet-tx-overlay";
import { openNotificationStream } from "@/lib/api/notifications";

type ReviewFilter = "all" | "pending" | "processed";

type ReviewerCampaignRow = {
    campaign: PublicCampaignItem;
    pendingMilestones: PublicCampaignMilestone[];
    processedMilestones: PublicCampaignMilestone[];
};

// Các status rõ ràng là đang chờ reviewer xem xét (không cần nhìn vào approvedAt)
const CLEARLY_PENDING_STATUSES = new Set([
    "submitted",
    "pending_verification",
    "resubmittable",
]);

// Các status rõ ràng là đã xử lý xong (không cần nhìn vào approvedAt)
const CLEARLY_DONE_STATUSES = new Set([
    "failed",
    "refunded",
    "review_timeout",
    "deadline_exceeded",
]);

/**
 * Milestone "disbursed" trong DB = tiền đã được giải ngân tới creator (bắt đầu làm việc).
 * Trạng thái này chưa có nghĩa là milestone đã hoàn thành — reviewer vẫn cần approve.
 * Milestone chỉ thực sự xong khi có approvedAt (backend set khi MilestoneApproved event tới).
 *
 * "approved" là trạng thái tạm thời backend ghi ngay khi MilestoneApproved event tới,
 * trước khi MilestoneDisbursed event kế tiếp tới và overwrite thành "disbursed" cho milestone đó.
 */
function isMilestoneNeedingReview(milestone: PublicCampaignMilestone): boolean {
    if (CLEARLY_PENDING_STATUSES.has(milestone.status)) return true;
    // disbursed nhưng chưa có approvedAt = tiền đã gửi, creator đang làm, cần reviewer duyệt
    if (milestone.status === "disbursed" && !milestone.approvedAt) return true;
    return false;
}

function isMilestoneFullyCompleted(milestone: PublicCampaignMilestone): boolean {
    if (CLEARLY_DONE_STATUSES.has(milestone.status)) return true;
    if (milestone.status === "approved") return true;
    // disbursed + approvedAt = đã được reviewer duyệt và hoàn thành
    if (milestone.status === "disbursed" && Boolean(milestone.approvedAt)) return true;
    return false;
}

const DEFAULT_APPROVAL_STATUS: MilestoneApprovalStatus = {
    safeAddress: "",
    required: 0,
    confirmed: 0,
    executed: false,
    signers: [],
    pendingTxHash: "",
};

const STATUS_LABELS: Record<string, string> = {
    submitted: "Đang chờ duyệt",
    pending_verification: "Chờ xác minh",
    resubmittable: "Cần nộp lại",
    approved: "Đã phê duyệt",
    // disbursed có 2 ý nghĩa — label hiển thị theo approvedAt, xem getStatusLabel bên dưới
    disbursed: "Đã giải ngân (chờ duyệt)",
    disbursed_done: "Đã hoàn thành",
    failed: "Thất bại",
    refunded: "Đã hoàn tiền",
    review_timeout: "Quá hạn duyệt",
    deadline_exceeded: "Quá hạn mốc",
};

const STATUS_BADGE: Record<string, string> = {
    submitted: "bg-amber-100 text-amber-800 border-amber-200",
    pending_verification: "bg-sky-100 text-sky-800 border-sky-200",
    resubmittable: "bg-orange-100 text-orange-800 border-orange-200",
    approved: "bg-emerald-100 text-emerald-800 border-emerald-200",
    disbursed: "bg-amber-100 text-amber-800 border-amber-200",       // chờ duyệt
    disbursed_done: "bg-teal-100 text-teal-800 border-teal-200",    // đã xong
    failed: "bg-rose-100 text-rose-800 border-rose-200",
    refunded: "bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200",
    review_timeout: "bg-violet-100 text-violet-800 border-violet-200",
    deadline_exceeded: "bg-slate-200 text-slate-700 border-slate-300",
};

const PRIMARY_FILTER_OPTIONS: Array<{ value: ReviewFilter; label: string }> = [
    { value: "all", label: "Tất cả mốc" },
    { value: "pending", label: "Đang chờ duyệt" },
    { value: "processed", label: "Đã xử lý" },
];
const REVIEWER_CAMPAIGN_PAGE_SIZE = 10;

function collectMilestonesByFilter(
    row: ReviewerCampaignRow,
    filter: ReviewFilter,
) {
    if (filter === "pending") return row.pendingMilestones;
    if (filter === "processed") return row.processedMilestones;

    return [...row.pendingMilestones, ...row.processedMilestones].sort(
        (a, b) =>
            getMilestoneActivityTimestamp(b) - getMilestoneActivityTimestamp(a),
    );
}

function toApprovalKey(campaignId: number, milestoneId: number) {
    return `${campaignId}:${milestoneId}`;
}

function shortenAddress(value: string) {
    if (!value || value.length < 12) return value;
    return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function formatDate(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

function formatEth(wei: string) {
    try {
        const value = Number(formatEther(BigInt(wei || "0")));
        return value.toLocaleString("vi-VN", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 4,
        });
    } catch {
        return "0,00";
    }
}

function parseWei(value: string): bigint {
    try {
        return BigInt(value || "0");
    } catch {
        return 0n;
    }
}

function formatEthCompact(wei: string, maximumFractionDigits = 3) {
    try {
        const value = Number(formatEther(parseWei(wei)));
        return value.toLocaleString("vi-VN", {
            minimumFractionDigits: 0,
            maximumFractionDigits,
        });
    } catch {
        return "0";
    }
}

function getMilestoneActivityTimestamp(milestone: PublicCampaignMilestone): number {
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
    const latestMilestoneTimestamp = [
        ...row.pendingMilestones,
        ...row.processedMilestones,
    ].reduce(
        (latest, milestone) =>
            Math.max(latest, getMilestoneActivityTimestamp(milestone)),
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

function getCampaignCredibility(row: ReviewerCampaignRow) {
    const milestones = [...row.pendingMilestones, ...row.processedMilestones];
    const total = milestones.length;
    if (total === 0) {
        return {
            label: "Chưa đủ dữ liệu",
            badgeClass: "bg-slate-100 text-slate-700 border-slate-200",
            note: "Campaign chưa có milestone để đánh giá uy tín.",
        };
    }
    const completed = milestones.filter(isMilestoneFullyCompleted).length;
    const failed = milestones.filter((item) => item.status === "failed").length;
    const score = ((completed - failed * 0.5) / total) * 100;
    if (score >= 70) {
        return {
            label: "Uy tín cao",
            badgeClass: "bg-emerald-100 text-emerald-700 border-emerald-200",
            note: `${completed}/${total} milestone đã hoàn thành.`,
        };
    }
    if (score >= 40) {
        return {
            label: "Uy tín trung bình",
            badgeClass: "bg-amber-100 text-amber-700 border-amber-200",
            note: `${completed}/${total} milestone hoàn thành, cần xem thêm minh chứng.`,
        };
    }
    return {
        label: "Uy tín thấp",
        badgeClass: "bg-rose-100 text-rose-700 border-rose-200",
        note: `Có ${failed} milestone thất bại trong tổng ${total} milestone.`,
    };
}

function getStatusLabel(status: string, milestone?: PublicCampaignMilestone) {
    if (status === "disbursed" && milestone) {
        return milestone.approvedAt
            ? (STATUS_LABELS["disbursed_done"] ?? "Đã hoàn thành")
            : (STATUS_LABELS["disbursed"] ?? "Đã giải ngân (chờ duyệt)");
    }
    return STATUS_LABELS[status] || status;
}

function getStatusBadge(status: string, milestone?: PublicCampaignMilestone) {
    if (status === "disbursed" && milestone) {
        const key = milestone.approvedAt ? "disbursed_done" : "disbursed";
        return STATUS_BADGE[key] ?? "bg-slate-100 text-slate-700 border-slate-200";
    }
    return (
        STATUS_BADGE[status] || "bg-slate-100 text-slate-700 border-slate-200"
    );
}

function buildIpfsUrl(cid: string) {
    const normalized = (cid || "").trim();
    return normalized ? `https://ipfs.io/ipfs/${normalized}` : "";
}

function buildSignatureProgressLabel(status: MilestoneApprovalStatus) {
    if (!status.required || status.required <= 0) {
        return "Chưa có đề xuất đang chờ trên Gnosis Safe";
    }

    const waiting = Math.max(status.required - status.confirmed, 0);
    if (status.executed) {
        return `${status.confirmed}/${status.required} kiểm duyệt viên đã ký - giao dịch đã được thực thi`;
    }

    if (waiting === 0) {
        return `${status.confirmed}/${status.required} kiểm duyệt viên đã ký - đã đủ chữ ký, chờ Safe thực thi`;
    }

    return `${status.confirmed}/${status.required} kiểm duyệt viên đã ký - đang chờ ${waiting} người nữa`;
}

function RejectModal({
    isOpen,
    isSubmitting,
    onClose,
    onConfirm,
}: {
    isOpen: boolean;
    isSubmitting: boolean;
    onClose: () => void;
    onConfirm: (reason: string) => void;
}) {
    const [reason, setReason] = useState("");
    const MIN_CHARS = 10;
    const isValid = reason.trim().length >= MIN_CHARS;

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={
                    !isSubmitting
                        ? () => {
                              setReason("");
                              onClose();
                          }
                        : undefined
                }
            />
            <div className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
                <div className="mb-4 flex items-center gap-3">
                    <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-rose-100 text-xl">
                        ❌
                    </span>
                    <div>
                        <h3 className="text-lg font-bold text-slate-900">Từ chối milestone</h3>
                        <p className="text-sm text-slate-500">Nhập lý do từ chối để creator có thể cải thiện bằng chứng.</p>
                    </div>
                </div>

                <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    disabled={isSubmitting}
                    rows={4}
                    placeholder="Ví dụ: Bằng chứng chưa đủ rõ ràng, cần bổ sung hình ảnh hoàn công và tài liệu kiểm tra..."
                    className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:opacity-60"
                />
                <p className={`mt-1 text-right text-xs ${reason.trim().length < MIN_CHARS ? "text-rose-500" : "text-emerald-600"}`}>
                    {reason.trim().length}/{MIN_CHARS} ký tự tối thiểu
                </p>

                <div className="mt-4 flex justify-end gap-3">
                    <button
                        onClick={() => {
                            setReason("");
                            onClose();
                        }}
                        disabled={isSubmitting}
                        className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                    >
                        Huỷ
                    </button>
                    <button
                        onClick={() => {
                            if (!isValid) return;
                            onConfirm(reason.trim());
                            setReason("");
                        }}
                        disabled={!isValid || isSubmitting}
                        className="rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {isSubmitting ? "Đang gửi..." : "Xác nhận từ chối"}
                    </button>
                </div>
            </div>
        </div>
    );
}

function EvidenceCard({
    cid,
    submittedAt,
}: {
    cid: string;
    submittedAt: string;
}) {
    const [kind, setKind] = useState<"loading" | "image" | "pdf" | "other">(
        "loading",
    );
    const evidenceUrl = useMemo(() => buildIpfsUrl(cid), [cid]);
    const resolvedKind = evidenceUrl ? kind : "other";

    useEffect(() => {
        if (!evidenceUrl) return;

        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), 8_000);

        const detectKind = async () => {
            try {
                const headResponse = await fetch(evidenceUrl, {
                    method: "HEAD",
                    signal: controller.signal,
                    cache: "no-store",
                });

                const contentType = (
                    headResponse.headers.get("content-type") || ""
                ).toLowerCase();
                if (contentType.startsWith("image/")) {
                    setKind("image");
                    return;
                }
                if (contentType.includes("application/pdf")) {
                    setKind("pdf");
                    return;
                }
                setKind("other");
            } catch {
                setKind("other");
            }
        };

        detectKind();

        return () => {
            window.clearTimeout(timeout);
            controller.abort();
        };
    }, [evidenceUrl]);

    return (
        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <p className="text-xs font-semibold text-slate-600">CID</p>
            <p className="mt-1 break-all text-xs text-slate-700">{cid}</p>
            <p className="mt-2 text-xs text-slate-500">
                Nộp lúc: {formatDate(submittedAt)}
            </p>

            {resolvedKind === "loading" && (
                <p className="mt-2 text-xs text-slate-500">
                    Đang xác định loại tệp...
                </p>
            )}

            {resolvedKind === "image" && (
                <div className="mt-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={evidenceUrl}
                        alt="Evidence preview"
                        className="h-40 w-full rounded-lg border border-slate-200 bg-white object-contain"
                    />
                    <a
                        href={evidenceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1.5 inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                        Mở IPFS
                    </a>
                </div>
            )}

            {resolvedKind === "pdf" && (
                <a
                    href={evidenceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                    Mở PDF trên IPFS
                </a>
            )}

            {resolvedKind === "other" && (
                <a
                    href={evidenceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                    Mở tài liệu trên IPFS
                </a>
            )}
        </div>
    );
}

export default function ReviewerWorkspacePage() {
    const { address, isConnected } = useAccount();
    const { token, user } = useAuth();
    const { approveMilestone } = useApproveMilestone();

    const walletAddress = useMemo(
        () => (user?.wallet || address || "").trim().toLowerCase(),
        [address, user?.wallet],
    );

    const [filter, setFilter] = useState<ReviewFilter>("all");
    const [rows, setRows] = useState<ReviewerCampaignRow[]>([]);
    const [approvalStatusMap, setApprovalStatusMap] = useState<
        Record<string, MilestoneApprovalStatus>
    >({});
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [currentPage, setCurrentPage] = useState(0);
    const [hasMoreCampaigns, setHasMoreCampaigns] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
    const [approvingKey, setApprovingKey] = useState<string | null>(null);
    const [approvingTxHash, setApprovingTxHash] = useState<`0x${string}` | undefined>(undefined);
    const [rejectingKey, setRejectingKey] = useState<string | null>(null);
    const [actionMessage, setActionMessage] = useState<string | null>(null);
    const [actionIsSuccess, setActionIsSuccess] = useState(false);
    const [rejectModalTarget, setRejectModalTarget] = useState<{ campaignId: number; milestoneId: number } | null>(null);
    const loadMoreRef = useRef<HTMLDivElement | null>(null);
    const { isLoading: isApproveConfirming } = useWaitForTransactionReceipt({
        hash: approvingTxHash,
    });
    useRegisterWalletTxOverlay(Boolean(approvingKey) || isApproveConfirming);

    const assignedCampaignCount = useMemo(
        () =>
            rows.filter(
                (row) =>
                    Boolean(walletAddress) &&
                    (row.campaign.reviewerSafe || "").trim().toLowerCase() ===
                        walletAddress,
            ).length,
        [rows, walletAddress],
    );

    const normalizedIsReviewer = assignedCampaignCount > 0;
    const reviewerName =
        user?.displayName?.trim() || shortenAddress(walletAddress);

    const loadReviewerCampaigns = useCallback(async (options?: { reset?: boolean; page?: number }) => {
        const reset = options?.reset ?? false;
        const targetPage = options?.page ?? 1;

        try {
            if (reset) {
                setIsLoading(true);
            } else {
                setIsLoadingMore(true);
            }
            setIsRefreshing(true);
            setErrorMessage(null);

            const campaignsResponse = await getPublicCampaigns({
                page: targetPage,
                limit: REVIEWER_CAMPAIGN_PAGE_SIZE,
                reviewerSafe: walletAddress || undefined,
                sort: "updatedAt",
                order: "desc",
            });

            // 🐞 LOG 1: Xem toàn bộ response của Campaigns trả về
            console.log("📦 [API] Raw Campaigns Response:", campaignsResponse);

            const campaigns = campaignsResponse.items.filter((campaign) => {
                const safe = (campaign.reviewerSafe || "").trim().toLowerCase();
                return /^0x[a-f0-9]{40}$/.test(safe) && safe === walletAddress;
            });

            // 🐞 LOG 2: Xem các Campaigns đã được lọc đúng với ví của reviewer hiện tại
            console.log("🎯 [Filter] Campaigns của reviewer này:", campaigns);

            const milestonesResults = await Promise.allSettled(
                campaigns.map((campaign) =>
                    getPublicCampaignMilestones(campaign.onChainId),
                ),
            );

            // 🐞 LOG 3: Xem toàn bộ response của Milestones tương ứng với các Campaigns trên
            console.log("📑 [API] Raw Milestones Results:", milestonesResults);

            const nextRows: ReviewerCampaignRow[] = [];
            milestonesResults.forEach((result, index) => {
                if (result.status !== "fulfilled") {
                    console.error(`❌ [Lỗi] Không lấy được milestone cho campaign ID ${campaigns[index].onChainId}`, result.reason);
                    return;
                }

                const campaign = campaigns[index];
                const pendingMilestones = result.value.milestones.filter(
                    isMilestoneNeedingReview,
                );
                const processedMilestones = result.value.milestones.filter(
                    isMilestoneFullyCompleted,
                );
                pendingMilestones.sort(
                    (a, b) =>
                        getMilestoneActivityTimestamp(b) -
                        getMilestoneActivityTimestamp(a),
                );
                processedMilestones.sort(
                    (a, b) =>
                        getMilestoneActivityTimestamp(b) -
                        getMilestoneActivityTimestamp(a),
                );

                // 🐞 LOG 4: Xem chi tiết phân loại trạng thái milestone của từng campaign
                console.log(`🔍 [Phân loại] Campaign ID ${campaign.onChainId}:`, {
                    totalFetched: result.value.milestones.length,
                    pending: pendingMilestones,
                    processed: processedMilestones
                });

                if (
                    pendingMilestones.length === 0 &&
                    processedMilestones.length === 0
                ) {
                    return;
                }

                nextRows.push({
                    campaign,
                    pendingMilestones,
                    processedMilestones,
                });
            });

            // 🐞 LOG 5: Xem Dữ liệu cuối cùng sẽ được đưa vào State (để render ra UI)
            console.log("🚀 [State] Final Rows data:", nextRows);

            const sortedRows = sortReviewerRows(nextRows);

            setRows((prev) => {
                if (reset) return sortedRows;

                const mergedMap = new Map<number, ReviewerCampaignRow>();
                prev.forEach((row) => {
                    mergedMap.set(row.campaign.onChainId, row);
                });
                sortedRows.forEach((row) => {
                    mergedMap.set(row.campaign.onChainId, row);
                });

                return sortReviewerRows(Array.from(mergedMap.values()));
            });
            setCurrentPage(targetPage);
            setHasMoreCampaigns(
                targetPage < (campaignsResponse.pagination?.totalPages || 1),
            );
            setLastUpdatedAt(new Date().toLocaleTimeString("vi-VN"));
        } catch (error) {
            setErrorMessage(
                error instanceof Error
                    ? error.message
                    : "Không thể tải danh sách chiến dịch reviewer",
            );
        } finally {
            setIsRefreshing(false);
            setIsLoadingMore(false);
            setIsLoading(false);
        }
    }, [walletAddress]);

    const refreshApprovalStatuses = useCallback(async () => {
        if (!token || rows.length === 0) return;

        const pendingTargets = rows.flatMap((row) =>
            row.pendingMilestones.map((milestone) => ({
                campaignId: row.campaign.onChainId,
                milestoneId: milestone.milestoneId,
            })),
        );

        if (pendingTargets.length === 0) return;

        const statusResults = await Promise.allSettled(
            pendingTargets.map(async (target) => {
                const data = await getMilestoneApprovalStatus(
                    target.campaignId,
                    target.milestoneId,
                    token,
                );
                return {
                    key: toApprovalKey(target.campaignId, target.milestoneId),
                    data,
                };
            }),
        );

        setApprovalStatusMap((prev) => {
            const next = { ...prev };
            for (const result of statusResults) {
                if (result.status !== "fulfilled") continue;
                next[result.value.key] = result.value.data;
            }
            return next;
        });
    }, [rows, token]);

    useEffect(() => {
        setRows([]);
        setCurrentPage(0);
        setHasMoreCampaigns(false);
        loadReviewerCampaigns({ reset: true, page: 1 });
    }, [loadReviewerCampaigns]);

    useEffect(() => {
        const node = loadMoreRef.current;
        if (!node || isLoading || isLoadingMore || !hasMoreCampaigns) return;

        const observer = new IntersectionObserver(
            (entries) => {
                const first = entries[0];
                if (!first?.isIntersecting) return;
                loadReviewerCampaigns({ page: currentPage + 1 });
            },
            { rootMargin: "240px 0px" },
        );

        observer.observe(node);
        return () => observer.disconnect();
    }, [currentPage, hasMoreCampaigns, isLoading, isLoadingMore, loadReviewerCampaigns]);

    useEffect(() => {
        if (!normalizedIsReviewer || rows.length === 0) return;

        refreshApprovalStatuses();
        const timer = window.setInterval(() => {
            refreshApprovalStatuses();
        }, 30_000);

        return () => window.clearInterval(timer);
    }, [normalizedIsReviewer, refreshApprovalStatuses, rows.length]);

    // Tự động làm mới dữ liệu campaign/milestone mỗi 20 giây
    useEffect(() => {
        if (!walletAddress) return;
        const timer = window.setInterval(() => {
            loadReviewerCampaigns({ reset: true, page: 1 });
        }, 20_000);
        return () => window.clearInterval(timer);
    }, [loadReviewerCampaigns, walletAddress]);

    // Lắng nghe SSE notification: khi nhận thông báo milestone mới → reload ngay
    useEffect(() => {
        if (!token || !walletAddress) return;
        const controller = new AbortController();
        let active = true;
        const RELOAD_TYPES = new Set([
            "milestone_report_submitted",
            "milestone_disbursed",
            "campaign_created",
            "campaign_approved",
        ]);
        const connect = async () => {
            try {
                await openNotificationStream(
                    token,
                    (notification) => {
                        if (!active) return;
                        if (RELOAD_TYPES.has(notification.type)) {
                            loadReviewerCampaigns({ reset: true, page: 1 });
                        }
                    },
                    undefined,
                    controller.signal,
                );
                // Tự reconnect khi stream kết thúc
                if (active && !controller.signal.aborted) {
                    window.setTimeout(connect, 2000);
                }
            } catch {
                if (active && !controller.signal.aborted) {
                    window.setTimeout(connect, 4000);
                }
            }
        };
        connect();
        return () => {
            active = false;
            controller.abort();
        };
    }, [token, walletAddress, loadReviewerCampaigns]);

    const filteredRows = useMemo(() => {
        return rows
            .map((row) => {
                const milestones = collectMilestonesByFilter(row, filter);

                return {
                    campaign: row.campaign,
                    milestones,
                };
            })
            .filter((row) => row.milestones.length > 0);
    }, [filter, rows]);

    const handleApprove = useCallback(
        async (campaignId: number, milestoneId: number) => {
            if (!isConnected || !walletAddress) {
                setActionIsSuccess(false);
                setActionMessage("Vui lòng kết nối ví để gửi phê duyệt.");
                return;
            }

            const campaignReviewerSafe =
                rows
                    .find((item) => item.campaign.onChainId === campaignId)
                    ?.campaign.reviewerSafe?.trim()
                    .toLowerCase() || "";

            if (!campaignReviewerSafe) {
                setActionMessage(
                    "Chiến dịch chưa có reviewerSafe nên không thể gửi duyệt on-chain.",
                );
                return;
            }

            if (campaignReviewerSafe !== walletAddress) {
                setActionMessage(
                    "Ví hiện tại không trùng reviewerSafe của campaign này. Nếu dùng Gnosis Safe, hãy ký và thực thi giao dịch approveMilestone từ Safe.",
                );
                return;
            }

            const key = toApprovalKey(campaignId, milestoneId);
            setApprovingKey(key);
            setActionMessage(null);

            try {
                const txHash = await approveMilestone(campaignId, milestoneId);
                setApprovingTxHash(txHash as `0x${string}`);
                setActionIsSuccess(true);
                setActionMessage(`✅ Đã gửi giao dịch phê duyệt! Đang chờ xác nhận on-chain... TX: ${(txHash as string).slice(0, 10)}...`);
                await refreshApprovalStatuses();
                // Backend listener sẽ cập nhật DB sau khi tx được xác nhận on-chain.
                // Chờ ~4s rồi reload để bắt kịp dữ liệu mới từ backend.
                window.setTimeout(() => {
                    loadReviewerCampaigns({ reset: true, page: 1 });
                }, 4000);
            } catch (error) {
                setActionIsSuccess(false);
                setActionMessage(
                    error instanceof Error
                        ? error.message
                        : "Không thể gửi giao dịch phê duyệt",
                );
            } finally {
                setApprovingKey(null);
            }
        },
        [
            approveMilestone,
            isConnected,
            loadReviewerCampaigns,
            refreshApprovalStatuses,
            rows,
            walletAddress,
        ],
    );

    const openRejectModal = useCallback(
        (campaignId: number, milestoneId: number) => {
            if (!isConnected || !walletAddress) {
                setActionIsSuccess(false);
                setActionMessage("Vui lòng kết nối ví để gửi từ chối.");
                return;
            }
            if (!token) {
                setActionIsSuccess(false);
                setActionMessage("Bạn cần đăng nhập để gửi từ chối milestone.");
                return;
            }
            const campaignReviewerSafe =
                rows
                    .find((item) => item.campaign.onChainId === campaignId)
                    ?.campaign.reviewerSafe?.trim()
                    .toLowerCase() || "";
            if (!campaignReviewerSafe) {
                setActionIsSuccess(false);
                setActionMessage("Chiến dịch chưa có reviewerSafe nên không thể gửi từ chối on-chain.");
                return;
            }
            if (campaignReviewerSafe !== walletAddress) {
                setActionIsSuccess(false);
                setActionMessage("Ví hiện tại không trùng reviewerSafe của campaign này. Nếu dùng Gnosis Safe, hãy tạo giao dịch reject/fail milestone trong Safe UI.");
                return;
            }
            setRejectModalTarget({ campaignId, milestoneId });
        },
        [isConnected, rows, token, walletAddress],
    );

    const handleRejectConfirm = useCallback(
        async (reason: string) => {
            if (!rejectModalTarget || !token) return;
            const { campaignId, milestoneId } = rejectModalTarget;
            const key = toApprovalKey(campaignId, milestoneId);
            setRejectingKey(key);
            setActionMessage(null);
            try {
                await rejectMilestone(campaignId, milestoneId, token, reason);
                setRejectModalTarget(null);
                setActionIsSuccess(true);
                setActionMessage("✅ Đã ghi nhận từ chối milestone. Creator có thể nộp lại minh chứng.");
                await loadReviewerCampaigns({ reset: true, page: 1 });
                await refreshApprovalStatuses();
            } catch (error) {
                setActionIsSuccess(false);
                setActionMessage(
                    error instanceof Error ? error.message : "Không thể từ chối milestone",
                );
            } finally {
                setRejectingKey(null);
            }
        },
        [loadReviewerCampaigns, refreshApprovalStatuses, rejectModalTarget, token],
    );

    if (isLoading) {
        return (
            <div className="min-h-screen bg-slate-50 px-6 py-10">
                <div className="mx-auto max-w-6xl space-y-4 animate-pulse">
                    <div className="h-10 w-72 rounded bg-slate-200" />
                    <div className="h-32 rounded-xl bg-slate-200" />
                    <div className="h-32 rounded-xl bg-slate-200" />
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#eef2f7] px-4 py-8 text-slate-900 md:px-8 md:py-12">
            <main className="mx-auto max-w-6xl space-y-7">
                <header className="px-1 py-2 md:py-4">
                    <div className="flex flex-wrap items-start justify-between gap-8">
                        <div className="max-w-3xl">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="rounded-full bg-indigo-100 px-4 py-1 text-xs font-bold uppercase tracking-[0.12em] text-indigo-600">
                                    Khu vực reviewer
                                </span>
                                <span className="rounded-full bg-emerald-100 px-4 py-1 text-xs font-bold text-emerald-700">
                                    {normalizedIsReviewer
                                        ? "Đã có quyền reviewer"
                                        : "Chế độ chỉ xem dữ liệu"}
                                </span>
                            </div>

                            <h1 className="mt-4 text-3xl font-extrabold leading-[1.15] tracking-tight text-slate-900 md:text-[3.2rem]">
                                Chiến dịch của tôi (Reviewer)
                            </h1>

                            <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-600">
                                Theo dõi mốc chiến dịch, kiểm tra bằng chứng và
                                xử lý phê duyệt minh bạch trên blockchain.
                            </p>

                            <div className="mt-4 space-y-1 text-sm text-slate-600">
                                <p>
                                    Ví đăng nhập:{" "}
                                    {shortenAddress(walletAddress) ||
                                        "Chưa kết nối"}
                                </p>
                                <p>
                                    Hồ sơ reviewer:{" "}
                                    {reviewerName || "Chưa có tên hiển thị"}
                                </p>
                                <p>
                                    Số campaign gán cho ví này:{" "}
                                    {assignedCampaignCount}
                                </p>
                            </div>

                            <div className="mt-6 flex flex-wrap items-center gap-3">
                                <button
                                    onClick={() => setFilter("pending")}
                                    className="rounded-2xl bg-indigo-600 px-6 py-3 text-sm font-bold text-white shadow-[0_8px_20px_rgba(79,70,229,0.35)] transition hover:bg-indigo-700"
                                >
                                    Duyệt chiến dịch
                                </button>
                                <button
                                    onClick={async () => {
                                        setRows([]);
                                        setCurrentPage(0);
                                        setHasMoreCampaigns(false);
                                        await loadReviewerCampaigns({
                                            reset: true,
                                            page: 1,
                                        });
                                        await refreshApprovalStatuses();
                                    }}
                                    disabled={isRefreshing}
                                    className="rounded-2xl border border-slate-300 bg-white px-6 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-100 disabled:opacity-60"
                                >
                                    {isRefreshing
                                        ? "Đang làm mới..."
                                        : "Làm mới dữ liệu"}
                                </button>
                            </div>
                        </div>

                        <div className="w-full max-w-lg space-y-3 md:pt-2">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Bộ lọc
                            </p>

                            <div className="grid grid-cols-3 gap-2 rounded-2xl border border-slate-200 bg-white/70 p-1.5">
                                {PRIMARY_FILTER_OPTIONS.map((option) => (
                                    <button
                                        key={option.value}
                                        onClick={() => setFilter(option.value)}
                                        className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
                                            filter === option.value
                                                ? "bg-white text-indigo-700 shadow-sm ring-1 ring-indigo-200"
                                                : "text-slate-600 hover:bg-white"
                                        }`}
                                    >
                                        {option.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {!normalizedIsReviewer && (
                        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                            Tài khoản hiện tại chưa có quyền kiểm duyệt
                            on-chain. Bạn chỉ có thể xem dữ liệu.
                        </div>
                    )}
                </header>

                <div className="h-px w-full bg-slate-200/80" />

                {lastUpdatedAt && (
                    <p className="px-1 text-xs font-medium text-slate-500">
                        Cập nhật lúc: {lastUpdatedAt}
                    </p>
                )}

                {errorMessage && (
                    <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        {errorMessage}
                    </div>
                )}

                {actionMessage && (
                    <div className={`mb-4 rounded-2xl border px-4 py-3 text-sm ${actionIsSuccess ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-blue-200 bg-blue-50 text-blue-700"}`}>
                        {actionMessage}
                    </div>
                )}

                {filteredRows.length === 0 && (
                    <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center text-slate-600 shadow-sm">
                        Không có mốc chiến dịch phù hợp với bộ lọc hiện tại.
                    </div>
                )}

                <div className="space-y-6">
                    {filteredRows.map((row) => {
                        const milestones = row.milestones;
                        const campaignDescription =
                            row.campaign.description?.trim() ||
                            "Chưa có mô tả campaign.";
                        const remainingNeedWei =
                            parseWei(row.campaign.goalWei) -
                            parseWei(row.campaign.totalRaisedWei);
                        const remainingNeedDisplayWei =
                            remainingNeedWei > 0n ? remainingNeedWei.toString() : "0";
                        const credibility = getCampaignCredibility({
                            campaign: row.campaign,
                            pendingMilestones: milestones.filter(isMilestoneNeedingReview),
                            processedMilestones: milestones.filter(isMilestoneFullyCompleted),
                        });

                        return (
                            <section
                                key={row.campaign.onChainId}
                                className="overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-[0_10px_32px_rgba(15,23,42,0.08)]"
                            >
                                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                                    <div className="w-full border-b border-slate-200 bg-gradient-to-r from-indigo-50 via-sky-50 to-cyan-50 p-6">
                                        <div className="flex flex-wrap items-start justify-between gap-4">
                                            <div>
                                                <h2 className="text-2xl font-bold text-slate-900">
                                                    {row.campaign.title ||
                                                        `Chiến dịch #${row.campaign.onChainId}`}
                                                </h2>
                                                <p className="mt-2 max-w-3xl text-sm text-slate-700">
                                                    {campaignDescription}
                                                </p>
                                                <p className="mt-1 text-sm text-slate-600">
                                                    Mã campaign: #
                                                    {row.campaign.onChainId}
                                                </p>
                                                <p className="mt-1 text-sm text-slate-600">
                                                    Ví reviewer safe:{" "}
                                                    {row.campaign
                                                        .reviewerSafe ||
                                                        "Chưa cài đặt"}
                                                </p>
                                                <div className="mt-3 flex flex-wrap items-center gap-2">
                                                    <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${credibility.badgeClass}`}>
                                                        {credibility.label}
                                                    </span>
                                                    <span className="text-xs text-slate-600">
                                                        {credibility.note}
                                                    </span>
                                                </div>
                                            </div>
                                            <Link
                                                href={`/campaigns/${row.campaign.onChainId}/milestones`}
                                                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                                            >
                                                Xem dòng thời gian
                                            </Link>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4 p-6 pt-0">
                                    <div className="grid gap-3 md:grid-cols-3">
                                        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                                            <p className="text-xs font-medium text-slate-500">
                                                Mục tiêu gây quỹ
                                            </p>
                                            <p className="mt-1 text-base font-bold text-slate-900">
                                                {formatEthCompact(row.campaign.goalWei)} ETH
                                            </p>
                                        </div>
                                        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                                            <p className="text-xs font-medium text-slate-500">
                                                Đã huy động
                                            </p>
                                            <p className="mt-1 text-base font-bold text-emerald-700">
                                                {formatEthCompact(row.campaign.totalRaisedWei)} ETH
                                            </p>
                                        </div>
                                        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                                            <p className="text-xs font-medium text-slate-500">
                                                Còn cần thêm
                                            </p>
                                            <p className="mt-1 text-base font-bold text-amber-700">
                                                {formatEthCompact(remainingNeedDisplayWei)} ETH
                                            </p>
                                        </div>
                                    </div>
                                    {milestones.map((milestone) => {
                                        const key = toApprovalKey(
                                            row.campaign.onChainId,
                                            milestone.milestoneId,
                                        );
                                        const approvalStatus =
                                            approvalStatusMap[key] ||
                                            DEFAULT_APPROVAL_STATUS;
                                        const isApproving =
                                            approvingKey === key;
                                        const isRejecting =
                                            rejectingKey === key;
                                        const isPendingMilestone =
                                            isMilestoneNeedingReview(milestone);
                                        const hasEvidence =
                                            milestone.reportCids.length > 0;
                                        const canWalletApproveMilestone =
                                            Boolean(walletAddress) &&
                                            (row.campaign.reviewerSafe || "")
                                                .trim()
                                                .toLowerCase() ===
                                                walletAddress;

                                        return (
                                            <article
                                                key={key}
                                                className="rounded-2xl border border-slate-200 bg-slate-50 p-5"
                                            >
                                                <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                                                    <div>
                                                        <div className="mb-2 inline-flex items-center gap-2">
                                                            <span className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                                                                Mốc #
                                                                {
                                                                    milestone.milestoneId
                                                                }
                                                            </span>
                                                            <span
                                                                className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${getStatusBadge(milestone.status, milestone)}`}
                                                            >
                                                                {getStatusLabel(
                                                                    milestone.status,
                                                                    milestone,
                                                                )}
                                                            </span>
                                                        </div>
                                                        <h3 className="text-xl font-bold text-slate-900">
                                                            {milestone.title ||
                                                                `Milestone #${milestone.milestoneId}`}
                                                        </h3>
                                                        <p className="mt-1 text-sm text-slate-700">
                                                            {milestone.description ||
                                                                "Không có mô tả."}
                                                        </p>
                                                    </div>
                                                    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-right text-xs text-slate-600">
                                                        <p>
                                                            Hạn:{" "}
                                                            {formatDate(
                                                                milestone.deadline,
                                                            )}
                                                        </p>
                                                        <p className="mt-1">
                                                            Số tiền mốc:{" "}
                                                            <span className="font-semibold text-slate-800">
                                                                {formatEth(
                                                                    milestone.amountWei,
                                                                )}{" "}
                                                                ETH
                                                            </span>
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="mb-3 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-indigo-800">
                                                    {buildSignatureProgressLabel(
                                                        approvalStatus,
                                                    )}
                                                </div>

                                                {isPendingMilestone && (
                                                    <div className="mb-3 flex flex-wrap items-center gap-2">
                                                        <button
                                                            onClick={() =>
                                                                handleApprove(
                                                                    row.campaign.onChainId,
                                                                    milestone.milestoneId,
                                                                )
                                                            }
                                                            disabled={
                                                                isApproving ||
                                                                isRejecting ||
                                                                !hasEvidence ||
                                                                !canWalletApproveMilestone
                                                            }
                                                            title={!hasEvidence ? "Milestone chưa có bằng chứng" : !canWalletApproveMilestone ? "Ví không trùng reviewerSafe" : undefined}
                                                            className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                                                        >
                                                            {isApproving
                                                                ? "Đang gửi phê duyệt..."
                                                                : "Phê duyệt mốc"}
                                                        </button>

                                                        <button
                                                            onClick={() =>
                                                                openRejectModal(
                                                                    row.campaign.onChainId,
                                                                    milestone.milestoneId,
                                                                )
                                                            }
                                                            disabled={
                                                                isApproving ||
                                                                isRejecting ||
                                                                !canWalletApproveMilestone
                                                            }
                                                            title={!canWalletApproveMilestone ? "Ví không trùng reviewerSafe" : undefined}
                                                            className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-5 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                                                        >
                                                            {isRejecting
                                                                ? "Đang xử lý từ chối..."
                                                                : "Từ chối mốc"}
                                                        </button>
                                                    </div>
                                                )}

                                                {isPendingMilestone &&
                                                    !canWalletApproveMilestone && (
                                                        <p className="mb-3 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800">
                                                            Ví hiện tại không
                                                            trùng reviewerSafe
                                                            của campaign này.
                                                            Nếu campaign dùng
                                                            Gnosis Safe, hãy
                                                            ký/phê duyệt giao
                                                            dịch trong Safe UI.
                                                        </p>
                                                    )}

                                                {!hasEvidence && (
                                                    <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                                                        Milestone chưa có bằng
                                                        chứng nộp lên, tạm thời
                                                        không thể phê duyệt.
                                                    </p>
                                                )}

                                                {hasEvidence && (
                                                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                                                        {milestone.reportCids.map(
                                                            (
                                                                item,
                                                                itemIndex,
                                                            ) => (
                                                                <EvidenceCard
                                                                    key={`${milestone.milestoneId}-${item.cid}-${item.submittedAt}-${itemIndex}`}
                                                                    cid={
                                                                        item.cid
                                                                    }
                                                                    submittedAt={
                                                                        item.submittedAt
                                                                    }
                                                                />
                                                            ),
                                                        )}
                                                    </div>
                                                )}
                                            </article>
                                        );
                                    })}
                                </div>
                            </section>
                        );
                    })}
                </div>
                <div ref={loadMoreRef} className="h-2 w-full" />
                {isLoadingMore && (
                    <p className="py-2 text-center text-sm text-slate-500">
                        Đang tải thêm chiến dịch...
                    </p>
                )}
                {!isLoading && !isLoadingMore && !hasMoreCampaigns && rows.length > 0 && (
                    <p className="py-2 text-center text-xs text-slate-500">
                        Đã tải hết danh sách chiến dịch của reviewer.
                    </p>
                )}
            </main>

            <RejectModal
                isOpen={rejectModalTarget !== null}
                isSubmitting={rejectingKey !== null}
                onClose={() => setRejectModalTarget(null)}
                onConfirm={handleRejectConfirm}
            />
        </div>
    );
}
