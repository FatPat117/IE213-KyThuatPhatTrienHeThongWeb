"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { formatEther } from "viem";
import { useAccount, useWaitForTransactionReceipt } from "wagmi";
import {
    getMilestoneApprovalStatus,
    rejectMilestone,
    useAuth,
    useExecuteSafeTransaction,
    useProposeSafeTransaction,
    useReadMilestonesOnChain,
} from "@/lib";
import type {
    MilestoneApprovalStatus,
    PublicCampaignMilestone,
} from "@/lib/api/campaigns";
import { useRegisterWalletTxOverlay } from "@/context/wallet-tx-overlay";
import { openNotificationStream } from "@/lib/api/notifications";
import { useReviewerCampaigns } from "@/lib/hooks/use-reviewer-campaigns";
import { useOwnerSafes } from "@/lib/hooks/use-owner-safes";
import { showErrorToast, showSuccessToast } from "@/lib/ui/toast";
import {
    getWalletErrorMessage,
    isWalletUserRejectedMessage,
} from "@/lib/errors/normalize";

type ReviewFilter = "all" | "pending" | "processed";

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
    disbursed: "Đã giải ngân (chờ duyệt)",
    disbursed_done: "Đã hoàn thành",
    failed: "Thất bại",
    refunded: "Đã hoàn tiền",
    review_timeout: "Quá hạn duyệt",
    deadline_exceeded: "Quá hạn mốc",
};

const STATUS_BADGE: Record<string, string> = {
    submitted: "border border-amber-500/30 bg-amber-500/15 text-amber-300",
    pending_verification: "border border-cyan-500/30 bg-cyan-500/15 text-cyan-300",
    resubmittable: "border border-orange-500/30 bg-orange-500/15 text-orange-300",
    approved: "border border-emerald-500/30 bg-emerald-500/15 text-emerald-300",
    disbursed: "border border-amber-500/30 bg-amber-500/15 text-amber-300",
    disbursed_done: "border border-teal-500/30 bg-teal-500/15 text-teal-300",
    failed: "border border-rose-500/30 bg-rose-500/15 text-rose-300",
    refunded: "border border-fuchsia-500/30 bg-fuchsia-500/15 text-fuchsia-300",
    review_timeout: "border border-violet-500/30 bg-violet-500/15 text-violet-300",
    deadline_exceeded: "border border-slate-500/30 bg-slate-500/15 text-slate-300",
};

const PRIMARY_FILTER_OPTIONS: Array<{ value: ReviewFilter; label: string }> = [
    { value: "all", label: "Tất cả mốc" },
    { value: "pending", label: "Đang chờ duyệt" },
    { value: "processed", label: "Đã xử lý" },
];

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

function buildSignatureProgressLabel(status: MilestoneApprovalStatus, milestoneApprovedAt?: string | null): string {
    // If milestone is already approved in DB, show approved message
    if (milestoneApprovedAt) {
        return "  Đã được phê duyệt";
    }

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

// --- Sub-component for Milestone Actions with On-chain Proof Check ---
interface ReviewerMilestoneActionsProps {
    campaignId: number;
    milestone: PublicCampaignMilestone;
    approvalStatus: MilestoneApprovalStatus;
    walletAddress: string;
    myReviewerSafes: string[];
    campaignReviewerSafe: string;
    isApproving: boolean;
    isRejecting: boolean;
    isExecuting: boolean;
    handleApprove: (cid: number, mid: number) => void;
    handleReject: (cid: number, mid: number) => void;
    handleExecute: (cid: number, mid: number) => void;
    hasSigned: boolean;
    isFocusRefreshing: boolean;
}

function ReviewerMilestoneActions({
    campaignId,
    milestone,
    approvalStatus,
    walletAddress,
    myReviewerSafes,
    campaignReviewerSafe,
    isApproving,
    isRejecting,
    isExecuting,
    handleApprove,
    handleReject,
    handleExecute,
    hasSigned,
    isFocusRefreshing,
}: ReviewerMilestoneActionsProps) {
    // Fetch on-chain data to check for proof existence
    const { proofCidsByIndex, isLoading: isLoadingOnChain } = useReadMilestonesOnChain(
        campaignId,
        milestone.milestoneId + 1
    );

    const onChainProofs = proofCidsByIndex.get(milestone.milestoneId) || [];
    const hasOnChainProof = onChainProofs.length > 0;
    const hasDbEvidence = milestone.reportCids.length > 0;

    const isPendingMilestone =
        CLEARLY_PENDING_STATUSES.has(milestone.status) ||
        (milestone.status === "disbursed" && !milestone.approvedAt);

    const isActionable = isPendingMilestone && milestone.status !== "resubmittable";

    const hasRejected = milestone.rejectionVoters?.some(v => v.toLowerCase() === walletAddress.toLowerCase()) || false;

    const canWalletApproveMilestone =
        isActionable &&
        hasOnChainProof &&
        !hasSigned &&
        !hasRejected &&
        myReviewerSafes.includes(campaignReviewerSafe);

    const canWalletRejectMilestone =
        isActionable &&
        !hasRejected &&
        myReviewerSafes.includes(campaignReviewerSafe);

    const canExecute =
        isActionable &&
        hasOnChainProof &&
        myReviewerSafes.includes(campaignReviewerSafe) &&
        approvalStatus.confirmed >= approvalStatus.required &&
        !approvalStatus.executed &&
        Boolean(approvalStatus.pendingTxHash);

    // Decision: If DB has evidence but on-chain doesn't, show a warning
    const needsOnChainSubmission = hasDbEvidence && !hasOnChainProof;

    return (
        <div className="space-y-4">
            {/* Evidence List (On-chain) */}
            {hasOnChainProof ? (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {(() => {
                        const uniqueProofs = Array.from(new Set(onChainProofs.map(c => (c || "").trim().toLowerCase())))
                            .map(k => onChainProofs.find(c => (c || "").trim().toLowerCase() === k))
                            .filter(Boolean) as string[];

                        return uniqueProofs.map((cid, index) => (
                            <div
                                key={`${milestone.milestoneId}-onchain-${index}-${cid}`}
                                className="reviewer-evidence-card rounded-xl border p-3 shadow-sm ring-1 ring-blue-50/50"
                            >
                                <div className="flex items-center justify-between gap-2 mb-1.5">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                                        Minh chứng #{index + 1}
                                    </span>
                                    <span className="text-[10px] text-slate-400 font-medium">On-chain</span>
                                </div>
                                <p className="text-xs font-semibold text-slate-600">CID</p>
                                <p className="reviewer-evidence-cid mt-1 break-all rounded-lg border p-1.5 font-mono text-[11px] leading-relaxed">
                                    {cid}
                                </p>
                                <a
                                    href={`https://ipfs.io/ipfs/${cid}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="reviewer-evidence-link mt-2.5 inline-flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                    </svg>
                                    Mở IPFS
                                </a>
                            </div>
                        ));
                    })()}
                </div>
            ) : isLoadingOnChain ? (
                <div className="flex items-center gap-2 py-2 text-xs text-slate-400 italic">
                    <div className="h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-500" />
                    Đang kiểm tra minh chứng on-chain...
                </div>
            ) : null}

            {needsOnChainSubmission && isPendingMilestone && (
                <div className="flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-200 p-4 text-xs text-amber-800 shadow-sm">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div>
                        <p className="font-bold">Minh chứng chưa được nộp on-chain</p>
                        <p className="mt-0.5 opacity-90">
                            Creator đã upload tài liệu lên server nhưng <strong>chưa nộp vào Smart Contract</strong>. Vui lòng yêu cầu Creator hoàn tất thủ tục này để bạn có thể phê duyệt.
                        </p>
                    </div>
                </div>
            )}

            {isActionable && (
                <div className="flex flex-wrap items-center gap-3 pt-1">
                    <div className="flex flex-wrap items-center gap-3">
                        {hasSigned ? (
                            <span className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/15 px-5 py-2.5 text-sm font-bold text-emerald-300 ring-1 ring-emerald-500/20">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                Bạn đã ký duyệt
                            </span>
                        ) : (
                            <>
                                <button
                                    onClick={() => handleApprove(campaignId, milestone.milestoneId)}
                                    disabled={
                                        isApproving ||
                                        isRejecting ||
                                        isFocusRefreshing ||
                                        !hasOnChainProof ||
                                        !canWalletApproveMilestone ||
                                        isLoadingOnChain
                                    }
                                    title={
                                        isLoadingOnChain || isFocusRefreshing
                                            ? "Đang kiểm tra dữ liệu on-chain..."
                                            : !hasOnChainProof
                                                ? "Chưa có minh chứng trên Smart Contract"
                                                : hasRejected
                                                    ? "Bạn đã ký từ chối mốc này"
                                                    : !canWalletApproveMilestone
                                                        ? "Ví không trùng reviewerSafe"
                                                        : undefined
                                    }
                                    className="flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-700 hover:shadow-emerald-700/30 disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none"
                                >
                                    {isApproving ? (
                                        <>
                                            <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                                            Đang xử lý...
                                        </>
                                    ) : isFocusRefreshing ? (
                                        <>
                                            <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                                            Đang đồng bộ...
                                        </>
                                    ) : (
                                        "Phê duyệt mốc"
                                    )}
                                </button>

                                <button
                                    onClick={() => handleReject(campaignId, milestone.milestoneId)}
                                    disabled={
                                        isApproving ||
                                        isRejecting ||
                                        isFocusRefreshing ||
                                        !canWalletRejectMilestone ||
                                        hasRejected
                                    }
                                    title={
                                        hasRejected
                                            ? "Bạn đã ký từ chối mốc này"
                                            : !myReviewerSafes.includes(campaignReviewerSafe)
                                                ? "Ví không nằm trong danh sách reviewer của campaign"
                                                : milestone.status === "resubmittable"
                                                    ? "Đã từ chối, đang chờ Creator nộp lại minh chứng"
                                                : !isPendingMilestone
                                                    ? "Mốc không ở trạng thái chờ duyệt"
                                                    : undefined
                                    }
                                    className="reviewer-reject-btn-outline flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {isRejecting ? "Đang xử lý..." : isFocusRefreshing ? "Đang đồng bộ..." : hasRejected ? "Đã ký từ chối" : "Từ chối mốc"}
                                </button>
                            </>
                        )}

                        {/* Nút Thực thi luôn hiện nếu có thể thực thi, bất kể đã ký hay chưa */}
                        {(canExecute || Boolean(approvalStatus.pendingTxHash)) && (
                            <button
                                onClick={() => handleExecute(campaignId, milestone.milestoneId)}
                                disabled={
                                    isApproving ||
                                    isRejecting ||
                                    isExecuting ||
                                    isFocusRefreshing ||
                                    !canExecute ||
                                    isLoadingOnChain
                                }
                                title={
                                    isLoadingOnChain || isFocusRefreshing
                                        ? "Đang kiểm tra..."
                                        : !hasOnChainProof
                                        ? "Chưa có minh chứng on-chain"
                                        : !myReviewerSafes.includes(campaignReviewerSafe)
                                        ? "Ví không nằm trong danh sách reviewer của campaign"
                                        : approvalStatus.confirmed < approvalStatus.required
                                        ? `Chưa đủ chữ ký (${approvalStatus.confirmed}/${approvalStatus.required})`
                                        : approvalStatus.executed
                                        ? "Giao dịch đã được thực thi"
                                        : Boolean(approvalStatus.pendingTxHash)
                                        ? "Thực thi giao dịch trên Safe contract"
                                        : "Không tìm thấy pending transaction"
                                }
                                className="flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 hover:shadow-blue-700/30 disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none"
                            >
                                {isExecuting ? (
                                    <>
                                        <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                                        Đang thực thi...
                                    </>
                                ) : isFocusRefreshing ? (
                                    <>
                                        <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                                        Đang đồng bộ...
                                    </>
                                ) : (
                                    <>
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        Thực thi
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default function ReviewerWorkspacePage() {
    const { address, isConnected } = useAccount();
    const { token, user } = useAuth();
    const { propose: proposeSafeTx } = useProposeSafeTransaction();

    const walletAddress = useMemo(
        () => (user?.wallet || address || "").trim().toLowerCase(),
        [address, user?.wallet],
    );

    const [filter, setFilter] = useState<ReviewFilter>("pending");
    const [approvalStatusMap, setApprovalStatusMap] = useState<
        Record<string, MilestoneApprovalStatus>
    >({});
    const approvalStatusMapRef = useRef(approvalStatusMap);
    const isRefreshingRef = useRef(false);
    const lastRefreshRef = useRef<number>(0);
    const lastBlurRef = useRef<number>(0);
    const notificationTimerRef = useRef<number | null>(null);

    useEffect(() => {
        approvalStatusMapRef.current = approvalStatusMap;
    }, [approvalStatusMap]);

    // Use new hook that fetches campaigns based on Safe API
    const { rows, myReviewerSafes, isLoading, error, lastUpdatedAt, refresh } = useReviewerCampaigns();
    const { safes: ownerSafes } = useOwnerSafes();

    const [approvingKey, setApprovingKey] = useState<string | null>(null);
    const [rejectingKey, setRejectingKey] = useState<string | null>(null);
    const [executingKey, setExecutingKey] = useState<string | null>(null);
    const [isFocusRefreshing, setIsFocusRefreshing] = useState(false);
    const [indexingKeys, setIndexingKeys] = useState<Set<string>>(new Set());
    const [actionMessage, setActionMessage] = useState<string | null>(null);
    const [actionIsSuccess, setActionIsSuccess] = useState(false);
    const [rejectModalTarget, setRejectModalTarget] = useState<{ campaignId: number; milestoneId: number } | null>(null);
    const [rejectReason, setRejectReason] = useState("");
    const [rejectError, setRejectError] = useState<string | null>(null);
    const [txHash, setTxHash] = useState<`0x${string}` | undefined>(undefined);
    const {
        isLoading: isConfirming,
        isSuccess: isTxSuccess,
        isError: isTxError,
        error: txError,
    } = useWaitForTransactionReceipt({ hash: txHash });
    useRegisterWalletTxOverlay(Boolean(approvingKey) || Boolean(rejectingKey), rejectingKey ? "processing" : "signing");
    useRegisterWalletTxOverlay(isConfirming, "confirming");

    // Initialize execute hook
    const { execute: executeSafeTransaction, isPending: isExecuting } = useExecuteSafeTransaction();

    // Check if user has reviewer access (has at least one registered safe)
    const hasReviewerAccess = myReviewerSafes.length > 0;

    useEffect(() => {
        if (!error) return;
        showErrorToast(error);
    }, [error]);

    useEffect(() => {
        if (!actionMessage) return;
        if (actionIsSuccess) {
            showSuccessToast(actionMessage);
            return;
        }
        showErrorToast(actionMessage, {
            emphasis: !isWalletUserRejectedMessage(actionMessage),
        });
    }, [actionIsSuccess, actionMessage]);

    useEffect(() => {
        if (!rejectError) return;
        showErrorToast(rejectError, { emphasis: false });
    }, [rejectError]);

    const refreshApprovalStatuses = useCallback(async (forceRefresh = false) => {
        if (!token || rows.length === 0 || isRefreshingRef.current) return;
        isRefreshingRef.current = true;

        try {

        const pendingTargets = rows.flatMap((row) =>
            row.milestones
                .filter((m) => {
                    // 1. Filter theo DB status (như cũ)
                    const isPending = !CLEARLY_DONE_STATUSES.has(m.status) &&
                        (m.status === "disbursed" ? !m.approvedAt : true);
                    if (!isPending) return false;

                    // 2. Skip nếu đã fully approved on-chain (đủ chữ ký VÀ đã execute)
                    // Điều này tránh gọi API không cần thiết cho milestones đã hoàn tất
                    const key = toApprovalKey(row.campaign.onChainId, m.milestoneId);
                    const existingStatus = approvalStatusMapRef.current[key];

                    if (existingStatus && !forceRefresh) {
                        const isFullyApproved = existingStatus.confirmed >= existingStatus.required;
                        if (isFullyApproved && existingStatus.executed) {
                            return false; // Skip - milestone đã được phê duyệt và thực thi hoàn toàn
                        }
                    }

                    return true; // Cần fetch approval status
                })
                .map((milestone) => ({
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
                    forceRefresh
                );
                return {
                    key: toApprovalKey(target.campaignId, target.milestoneId),
                    data,
                };
            }),
        );

        setApprovalStatusMap((prev) => {
            const next = { ...prev };
            let hasChanges = false;
            for (const result of statusResults) {
                if (result.status !== "fulfilled") continue;
                const currentStatus = prev[result.value.key];
                const newStatus = result.value.data;
                // Basic comparison to avoid setting state if nothing changed
                if (JSON.stringify(currentStatus) !== JSON.stringify(newStatus)) {
                    next[result.value.key] = newStatus;
                    hasChanges = true;
                }
            }
            return hasChanges ? next : prev;
        });
        } finally {
            isRefreshingRef.current = false;
        }
    }, [rows, token]);

    useEffect(() => {
        // Initial load is handled by useReviewerCampaigns hook
    }, []);

    useEffect(() => {
        if (!hasReviewerAccess || rows.length === 0) return;

        // Clean up indexingKeys if the status in rows has changed from 'pending' ones
        if (indexingKeys.size > 0) {
            setIndexingKeys(prev => {
                const next = new Set(prev);
                let changed = false;
                rows.forEach(row => {
                    row.milestones.forEach(m => {
                        const key = toApprovalKey(row.campaign.onChainId, m.milestoneId);
                        if (next.has(key)) {
                            // If it's no longer in a "clearly pending" state we were tracking
                            // Or if it's already approved/disbursed in DB
                            const isProcessed = !CLEARLY_PENDING_STATUSES.has(m.status) || Boolean(m.approvedAt);
                            if (isProcessed) {
                                next.delete(key);
                                changed = true;
                            }
                        }
                    });
                });
                return changed ? next : prev;
            });
        }

        refreshApprovalStatuses();
        const timer = window.setInterval(() => {
            refreshApprovalStatuses();
        }, 45_000); // 45 seconds (increased from 20s to prevent 429)

        return () => window.clearInterval(timer);
    }, [hasReviewerAccess, refreshApprovalStatuses, rows, indexingKeys.size]);

    // Force refresh when window regains focus (useful after signing in Safe tab)
    useEffect(() => {
        if (!hasReviewerAccess) return;

        const handleBlur = () => {
            lastBlurRef.current = Date.now();
        };

        const handleFocus = async () => {
            const now = Date.now();
            const timeSinceBlur = now - lastBlurRef.current;
            const timeSinceLastRefresh = now - lastRefreshRef.current;

            // Only refresh if:
            // 1. User was away for more than 5 seconds (avoid flickering on quick task switching)
            // 2. We haven't refreshed in the last 15 seconds
            if (timeSinceBlur > 5000 && timeSinceLastRefresh > 15000) {
                console.log('[ReviewerPage] Window focused after gap, triggering silent refresh...');
                lastRefreshRef.current = now;

                // Silent background refresh - do not set isFocusRefreshing=true
                // to avoid annoying the user with loading spinners while they work
                try {
                    await Promise.allSettled([
                        refreshApprovalStatuses(true),
                        refresh(true)
                    ]);
                } catch (e) {
                    console.error('[ReviewerPage] Background refresh failed', e);
                }
            }
        };

        window.addEventListener('blur', handleBlur);
        window.addEventListener('focus', handleFocus);
        return () => {
            window.removeEventListener('blur', handleBlur);
            window.removeEventListener('focus', handleFocus);
        };
    }, [hasReviewerAccess, refreshApprovalStatuses, refresh]);

    // Listen for SSE notifications
    useEffect(() => {
        if (!token || !walletAddress) return;
        const controller = new AbortController();
        let active = true;
        const RELOAD_TYPES = new Set([
            "milestone_report_submitted",
            "milestone_disbursed",
            "campaign_created",
            "campaign_approved",
            "milestone_approved",
            "milestone_rejected",
            "milestone_failed",
            "campaign_failed"
        ]);
        const connect = async () => {
            try {
                await openNotificationStream(
                    token,
                    (notification) => {
                        if (!active) return;
                        if (RELOAD_TYPES.has(notification.type)) {
                            // Debounce reload to handle bursts of notifications
                            if (notificationTimerRef.current) {
                                window.clearTimeout(notificationTimerRef.current);
                            }
                            notificationTimerRef.current = window.setTimeout(() => {
                                console.log('[ReviewerPage] SSE notification received, debounced refresh...');
                                refresh(true);
                            }, 1500);
                        }
                    },
                    undefined,
                    controller.signal,
                );
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
            if (notificationTimerRef.current) window.clearTimeout(notificationTimerRef.current);
        };
    }, [token, walletAddress, refresh]);

    // Handle transaction receipt after execute
    useEffect(() => {
        if (!txHash) return;

        if (isTxSuccess) {
            setActionIsSuccess(true);
            setActionMessage("  Giao dịch đã được thực thi thành công!");
            refreshApprovalStatuses(true);
            // Poll campaigns to show updated milestone status from Indexer
            let attempts = 0;
            const timer = window.setInterval(() => {
                attempts += 1;
                refresh(true);
                if (attempts >= 8) window.clearInterval(timer);
            }, 3000);
            setTxHash(undefined);
            // setExecutingKey(null); // Keep executingKey or add to indexingKeys
            const key = executingKey;
            if (key) {
                setIndexingKeys(prev => new Set(prev).add(key));
            }
            setExecutingKey(null);
            return;
        }

        if (isTxError) {
            const normalizedMessage = getWalletErrorMessage(txError, {
                fallback: "Thực thi giao dịch thất bại.",
            });
            setActionIsSuccess(false);
            setActionMessage(normalizedMessage);
            setTxHash(undefined);
            setExecutingKey(null);
        }
    }, [isTxSuccess, isTxError, txError, refreshApprovalStatuses, refresh]);

    const filteredRows = useMemo(() => {
        return rows
            .map((row) => {
                const pending = row.milestones.filter((m) => {
                    if (CLEARLY_PENDING_STATUSES.has(m.status)) return true;
                    if (m.status === "disbursed" && !m.approvedAt) return true;
                    return false;
                });
                const processed = row.milestones.filter((m) => {
                    if (CLEARLY_DONE_STATUSES.has(m.status)) return true;
                    if (m.status === "approved") return true;
                    if (m.status === "disbursed" && Boolean(m.approvedAt)) return true;
                    return false;
                });

                const milestones =
                    filter === "pending"
                        ? pending
                        : filter === "processed"
                            ? processed
                            : [...pending, ...processed].sort(
                                (a, b) =>
                                    getMilestoneActivityTimestamp(b) -
                                    getMilestoneActivityTimestamp(a),
                            );

                return {
                    campaign: row.campaign,
                    milestones,
                };
            })
            .filter((row) => row.milestones.length > 0);
    }, [filter, rows]);

    const handleApprove = useCallback(
        async (campaignId: number, milestoneId: number) => {
            console.log('[handleApprove] START', { campaignId, milestoneId, walletAddress, myReviewerSafes });
            if (!isConnected || !walletAddress) {
                setActionIsSuccess(false);
                setActionMessage("Vui lòng kết nối ví để gửi phê duyệt.");
                return;
            }

            const campaignRow = rows.find((item) => item.campaign.onChainId === campaignId);
            const campaignReviewerSafe = campaignRow?.campaign.reviewerSafe?.trim().toLowerCase() || "";
            console.log('[handleApprove] campaignReviewerSafe:', campaignReviewerSafe);

            if (!campaignReviewerSafe) {
                setActionMessage(
                    "Chiến dịch chưa có reviewerSafe nên không thể gửi duyệt on-chain.",
                );
                return;
            }

            // Check if this Safe is owned by the reviewer (is in their myReviewerSafes list)
            if (!myReviewerSafes.includes(campaignReviewerSafe)) {
                setActionMessage(
                    "Safe address của chiến dịch này không nằm trong danh sách Safe bạn được gán làm reviewer.",
                );
                return;
            }

            const key = toApprovalKey(campaignId, milestoneId);
            setApprovingKey(key);
            setActionMessage(null);

            try {
                console.log('[handleApprove] Calling proposeSafeTx with:', { campaignId, milestoneId, safe: campaignReviewerSafe });
                // Read existing confirmed count before proposing (for accurate message)
                const currentApprovalStatus = approvalStatusMap[key];
                const alreadyConfirmed = currentApprovalStatus?.confirmed ?? 0;

                // Propose transaction FROM the Safe address (not the wallet)
                const result = await proposeSafeTx(campaignId, milestoneId, campaignReviewerSafe as `0x${string}`, alreadyConfirmed);
                console.log('[handleApprove] Proposal SUCCESS:', result);
                setActionIsSuccess(true);
                setActionMessage(`  ${result.message}`);

                // Open Safe UI in new tab so reviewer can see and continue signing
                window.open(result.safeUiUrl, '_blank');

                await refreshApprovalStatuses(true);
                // Reload campaigns after a short delay
                window.setTimeout(() => {
                    refresh();
                }, 3000);
            } catch (error) {
                console.error('[handleApprove] ERROR:', error);
                const normalizedMessage = getWalletErrorMessage(error, {
                    fallback: "Không thể đề xuất giao dịch Safe phê duyệt",
                });
                setActionIsSuccess(false);
                setActionMessage(normalizedMessage);
            } finally {
                setApprovingKey(null);
            }
        },
        [proposeSafeTx, isConnected, refresh, refreshApprovalStatuses, rows, walletAddress, myReviewerSafes, approvalStatusMap],
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
            const campaignRow = rows.find((item) => item.campaign.onChainId === campaignId);
            const campaignReviewerSafe = campaignRow?.campaign.reviewerSafe?.trim().toLowerCase() || "";
            if (!campaignReviewerSafe) {
                setActionIsSuccess(false);
                setActionMessage("Chiến dịch chưa có reviewerSafe nên không thể gửi từ chối on-chain.");
                return;
            }
            // Check if this Safe is owned by the reviewer
            if (!myReviewerSafes.includes(campaignReviewerSafe)) {
                setActionIsSuccess(false);
                setActionMessage("Safe address của chiến dịch này không nằm trong danh sách Safe bạn được gán làm reviewer.");
                return;
            }
            setRejectModalTarget({ campaignId, milestoneId });
            setActionMessage(null);
        },
        [isConnected, rows, token, walletAddress],
    );

    const handleRejectConfirm = useCallback(
        async (reason: string) => {
            if (!rejectModalTarget || !token) return false;
            const { campaignId, milestoneId } = rejectModalTarget;
            const key = toApprovalKey(campaignId, milestoneId);
            setRejectingKey(key);
            setActionMessage(null);
            setRejectError(null);
            try {
                const result = await rejectMilestone(campaignId, milestoneId, token, reason);

                // Đóng modal ngay lập tức để hiện rõ màn hình loading overlay nếu có delay
                setRejectModalTarget(null);
                setRejectReason("");
                setRejectError(null);

                setActionIsSuccess(true);
                const successMsg = (result as any).message || "Đã ghi nhận từ chối milestone. Creator đã được thông báo.";
                setActionMessage(successMsg);
                showSuccessToast(successMsg);

                // Add to indexing keys to show "Syncing"
                setIndexingKeys(prev => new Set(prev).add(key));

                await refresh(true);
                await refreshApprovalStatuses();
                return true;
            } catch (error) {
                const msg = error instanceof Error ? error.message : "Không thể từ chối milestone";
                setRejectError(msg);
                setActionIsSuccess(false);
                setActionMessage(msg);
                return false;
            } finally {
                setRejectingKey(null);
            }
        },
        [refresh, refreshApprovalStatuses, rejectModalTarget, token],
    );

    const handleExecute = useCallback(
        async (campaignId: number, milestoneId: number) => {
            const key = toApprovalKey(campaignId, milestoneId);
            setExecutingKey(key);
            setActionMessage(null);
            setActionIsSuccess(false);

            try {
                const campaignRow = rows.find(
                    (item) => item.campaign.onChainId === campaignId
                );
                const campaignReviewerSafe =
                    campaignRow?.campaign.reviewerSafe?.trim().toLowerCase() || "";

                if (!campaignReviewerSafe) {
                    throw new Error(
                        "Chiến dịch chưa có reviewerSafe nên không thể thực thi giao dịch."
                    );
                }

                const status = approvalStatusMap[key];
                if (!status) {
                    throw new Error(
                        "Không tìm thấy thông tin phê duyệt. Vui lòng thử làm mới."
                    );
                }

                if (!status.pendingTxHash) {
                    throw new Error(
                        "Không tìm thấy pending transaction hash. Có thể transaction chưa được propose."
                    );
                }

                console.log("[handleExecute] Executing Safe transaction:", {
                    safe: campaignReviewerSafe,
                    safeTxHash: status.pendingTxHash,
                });

                const hash = await executeSafeTransaction(
                    campaignReviewerSafe as `0x${string}`,
                    status.pendingTxHash
                );

                setTxHash(hash);
                console.log("[handleExecute] Transaction submitted:", hash);
            } catch (error) {
                console.error("[handleExecute] ERROR:", error);
                const normalizedMessage = getWalletErrorMessage(error, {
                    fallback: "Không thể thực thi giao dịch. Vui lòng thử lại.",
                });
                setActionMessage(normalizedMessage);
                setActionIsSuccess(false);
                setExecutingKey(null);
            }
        },
        [
            rows,
            approvalStatusMap,
            executeSafeTransaction,
            refreshApprovalStatuses,
            refresh,
        ]
    );

    if (isLoading) {
        return (
            <div className="page-shell reviewer-page relative min-h-screen overflow-hidden px-6 py-10">
                <div className="reviewer-ambient" aria-hidden />
                <div className="relative z-10 mx-auto max-w-6xl space-y-4 animate-pulse">
                    <div className="h-10 w-72 rounded-full bg-white/10" />
                    <div className="web3-glass-card h-32 rounded-2xl" />
                    <div className="web3-glass-card h-32 rounded-2xl" />
                </div>
            </div>
        );
    }

    return (
        <div className="page-shell reviewer-page relative min-h-screen overflow-hidden px-4 py-8 md:px-8 md:py-12">
            <div className="reviewer-ambient" aria-hidden />
            <div className="reviewer-hero-glow" aria-hidden />
            <main className="relative z-10 mx-auto max-w-6xl space-y-7">
                <header className="relative px-1 py-2 md:py-4">
                    <div className="flex flex-wrap items-start justify-between gap-8">
                        <div className="max-w-3xl">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="web3-neon-badge rounded-full px-4 py-1.5 text-[11px] font-bold">
                                    Khu vực reviewer
                                </span>
                                <span
                                    className={`rounded-full px-4 py-1.5 text-[11px] font-bold ${
                                        hasReviewerAccess
                                            ? "web3-neon-badge web3-neon-badge--success"
                                            : "web3-neon-badge web3-neon-badge--muted"
                                    }`}
                                >
                                    {hasReviewerAccess
                                        ? "Đã có quyền reviewer"
                                        : "Chế độ chỉ xem dữ liệu"}
                                </span>
                            </div>

                            <h1 className="font-display mt-5 text-3xl font-extrabold leading-[1.12] tracking-tight text-gradient-hero md:text-[3.25rem]">
                                Các mốc đang chờ bạn phê duyệt
                            </h1>

                            <p className="font-body mt-4 max-w-2xl text-lg leading-8 text-[var(--text-secondary)]">
                                Theo dõi mốc chiến dịch, kiểm tra bằng chứng và
                                xử lý phê duyệt minh bạch trên blockchain.
                            </p>

                            <div className="font-accent mt-4 space-y-1 text-sm text-[var(--text-secondary)]">
                                <p>
                                    Ví đăng nhập:{" "}
                                    <span className="font-mono-data text-[var(--accent-cyan)]">
                                        {shortenAddress(walletAddress) ||
                                            "Chưa kết nối"}
                                    </span>
                                </p>
                                <p>
                                    Số ví Safe được gán làm kiểm duyệt viên:{" "}
                                    <span className="font-semibold text-[var(--text-primary)]">
                                        {myReviewerSafes.length}
                                    </span>
                                </p>
                            </div>

                            <div className="mt-7 flex flex-wrap items-center gap-3">
                                <button
                                    type="button"
                                    onClick={() => setFilter("pending")}
                                    className="web3-btn-primary rounded-full px-7 py-3 text-sm"
                                >
                                    Duyệt chiến dịch
                                </button>
                                <button
                                    type="button"
                                    onClick={() => refresh()}
                                    disabled={isLoading}
                                    className="web3-btn-glass rounded-full px-7 py-3 text-sm disabled:opacity-50"
                                >
                                    {isLoading
                                        ? "Đang làm mới..."
                                        : "Làm mới dữ liệu"}
                                </button>
                            </div>
                        </div>

                        <div className="w-full max-w-lg space-y-3 md:pt-2">
                            <p className="font-accent text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-secondary)]">
                                Bộ lọc
                            </p>

                            <div className="web3-filter-track grid grid-cols-3 gap-1">
                                {PRIMARY_FILTER_OPTIONS.map((option) => (
                                    <button
                                        key={option.value}
                                        type="button"
                                        onClick={() => setFilter(option.value)}
                                        className={`web3-filter-pill px-3 py-2.5 text-sm ${filter === option.value ? "is-active" : ""}`}
                                    >
                                        {option.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {!hasReviewerAccess && (
                        <div className="web3-glass-card mt-6 rounded-2xl border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                            Tài khoản hiện tại chưa có quyền kiểm duyệt on-chain.
                            Bạn chỉ có thể xem dữ liệu.
                        </div>
                    )}
                </header>

                <div className="h-px w-full bg-gradient-to-r from-transparent via-[rgba(139,92,246,0.35)] to-transparent" />

                {lastUpdatedAt && (
                    <p className="font-mono-data px-1 text-xs font-medium text-[var(--text-secondary)]">
                        Cập nhật lúc: {lastUpdatedAt}
                    </p>
                )}

                {filteredRows.length === 0 && !isLoading && (
                    <div className="reviewer-empty-card web3-glass-card rounded-3xl p-10 text-center">
                        {hasReviewerAccess
                            ? "Không có mốc chiến dịch phù hợp với bộ lọc hiện tại."
                            : "Bạn chưa có Safe nào được gán làm reviewer."}
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

                        return (
                            <section
                                key={row.campaign.onChainId}
                                className="reviewer-campaign-card web3-glass-card overflow-hidden rounded-[26px]"
                            >
                                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                                    <div className="reviewer-campaign-header w-full border-b p-6">
                                        <div className="flex flex-wrap items-start justify-between gap-4">
                                            <div>
                                                <h2 className="font-display text-2xl font-bold text-[var(--text-primary)]">
                                                    {row.campaign.title ||
                                                        `Chiến dịch #${row.campaign.onChainId}`}
                                                </h2>
                                                <p className="mt-2 max-w-3xl text-sm text-[var(--text-secondary)]">
                                                    {campaignDescription}
                                                </p>
                                                <p className="mt-1 font-mono text-sm text-[var(--text-secondary)]">
                                                    Mã campaign: #
                                                    {row.campaign.onChainId}
                                                </p>
                                                <p className="mt-1 font-mono text-sm text-[var(--text-secondary)]">
                                                    Ví reviewer safe:{" "}
                                                    {row.campaign
                                                        .reviewerSafe ||
                                                        "Chưa cài đặt"}
                                                </p>
                                            </div>
                                            <Link
                                                href={`/campaigns/${row.campaign.onChainId}/milestones`}
                                                className="web3-btn-glass rounded-full px-4 py-2 text-sm font-semibold"
                                            >
                                                Xem dòng thời gian
                                            </Link>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4 p-6 pt-0">
                                    <div className="grid gap-3 md:grid-cols-3">
                                        <div className="reviewer-stat-box px-4 py-3">
                                            <p className="reviewer-stat-label">
                                                Mục tiêu gây quỹ
                                            </p>
                                            <p className="reviewer-stat-value mt-1 text-base">
                                                {formatEthCompact(row.campaign.goalWei)} ETH
                                            </p>
                                        </div>
                                        <div className="reviewer-stat-box px-4 py-3">
                                            <p className="reviewer-stat-label">
                                                Đã huy động
                                            </p>
                                            <p className="reviewer-stat-value reviewer-stat-value--raised mt-1 text-base">
                                                {formatEthCompact(row.campaign.totalRaisedWei)} ETH
                                            </p>
                                        </div>
                                        <div className="reviewer-stat-box px-4 py-3">
                                            <p className="reviewer-stat-label">
                                                Còn cần thêm
                                            </p>
                                            <p className="reviewer-stat-value reviewer-stat-value--remaining mt-1 text-base">
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

                                        // Check if current wallet has already signed this milestone
                                        const hasSigned = approvalStatus.signers?.some(
                                            (signer) =>
                                                signer.toLowerCase() === walletAddress.toLowerCase()
                                        ) || false;

                                        const campaignReviewerSafe = row.campaign.reviewerSafe?.trim().toLowerCase() || "";

                                        return (
                                            <article
                                                key={key}
                                                className="reviewer-milestone-card web3-glass-card p-5"
                                            >
                                                <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                                                    <div>
                                                        <div className="mb-2 inline-flex items-center gap-2">
                                                            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--accent-cyan)]">
                                                                Mốc #
                                                                {milestone.milestoneId + 1}
                                                            </span>
                                                            <span
                                                                className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${indexingKeys.has(key) ? "border border-indigo-500/30 bg-indigo-500/15 text-indigo-300 animate-pulse" : (STATUS_BADGE[milestone.status] || "border border-slate-500/30 bg-slate-500/15 text-slate-300")}`}
                                                            >
                                                                {indexingKeys.has(key) ? "🔄 Đang đồng bộ..." : (STATUS_LABELS[milestone.status] || milestone.status)}
                                                            </span>
                                                        </div>
                                                        <h3 className="font-display text-xl font-bold text-[var(--text-primary)]">
                                                            {milestone.title ||
                                                                `Milestone #${milestone.milestoneId}`}
                                                        </h3>
                                                        <p className="mt-1 text-sm text-[var(--text-secondary)]">
                                                            {milestone.description ||
                                                                "Không có mô tả."}
                                                        </p>
                                                    </div>
                                                    <div className="reviewer-milestone-meta rounded-xl px-3 py-2 text-right text-xs">
                                                        <p>
                                                            Hạn:{" "}
                                                            {formatDate(
                                                                milestone.deadline,
                                                            )}
                                                        </p>
                                                        <p className="mt-1">
                                                            Số tiền mốc:{" "}
                                                            <span className="font-semibold text-[var(--text-primary)]">
                                                                {formatEth(
                                                                    milestone.amountWei,
                                                                )}{" "}
                                                                ETH
                                                            </span>
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="reviewer-safe-banner mb-3 rounded-xl px-4 py-3 text-sm">
                                                    {buildSignatureProgressLabel(
                                                        approvalStatus,
                                                        milestone.approvedAt,
                                                    )}
                                                </div>

                                                {milestone.pendingRejections !== undefined && milestone.pendingRejections > 0 && (
                                                    <div className="mb-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                                                        <span className="font-bold">⚠️ Đang từ chối:</span> Đã có {milestone.pendingRejections} lượt ký từ chối mốc này. (Đang chờ thêm chữ ký để chính thức yêu cầu nộp lại)
                                                    </div>
                                                )}

                                                <ReviewerMilestoneActions
                                                    campaignId={row.campaign.onChainId}
                                                    milestone={milestone}
                                                    approvalStatus={approvalStatus}
                                                    walletAddress={walletAddress}
                                                    myReviewerSafes={myReviewerSafes}
                                                    campaignReviewerSafe={campaignReviewerSafe}
                                                    isApproving={isApproving}
                                                    isRejecting={isRejecting}
                                                    isExecuting={isExecuting && executingKey === key}
                                                    handleApprove={handleApprove}
                                                    handleReject={openRejectModal}
                                                    handleExecute={handleExecute}
                                                    hasSigned={hasSigned}
                                                    isFocusRefreshing={isFocusRefreshing || indexingKeys.has(key)}
                                                />
                                            </article>
                                        );
                                    })}
                                </div>
                            </section>
                        );
                    })}
                </div>
            </main>

            {/* Reject Modal */}
            {rejectModalTarget && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                        onClick={() => {
                            if (!rejectingKey) {
                                setRejectModalTarget(null);
                                setRejectReason("");
                                setRejectError(null);
                            }
                        }}
                    />
                    <div className="reviewer-modal web3-glass-card relative w-full max-w-lg rounded-2xl p-6 shadow-2xl">
                        <div className="mb-4 flex items-center gap-3">
                            <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-rose-100 text-xl">

                            </span>
                            <div>
                                <h3 className="font-display text-lg font-bold text-[var(--text-primary)]">Từ chối milestone</h3>
                                <p className="text-sm text-[var(--text-secondary)]">Nhập lý do từ chối để creator có thể cải thiện bằng chứng.</p>
                            </div>
                        </div>

                        <textarea
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            disabled={Boolean(rejectingKey)}
                            rows={4}
                            placeholder="Ví dụ: Bằng chứng chưa đủ rõ ràng, cần bổ sung hình ảnh hoàn công và tài liệu kiểm tra..."
                            className={`w-full resize-none rounded-xl border px-4 py-3 text-sm outline-none disabled:opacity-60 ${rejectError ? "border-rose-400/70" : "border-[rgba(99,102,241,0.3)]"}`}
                        />
                        <p className={`mt-1 text-right text-xs ${rejectReason.trim().length < 10 ? "text-rose-500" : "text-emerald-600"}`}>
                            {rejectReason.trim().length}/10 ký tự tối thiểu
                        </p>

                        <div className="mt-4 flex justify-end gap-3">
                            <button
                                onClick={() => {
                                    setRejectModalTarget(null);
                                    setRejectReason("");
                                }}
                                disabled={Boolean(rejectingKey)}
                                className="web3-btn-glass rounded-full px-5 py-2.5 text-sm font-semibold disabled:opacity-60"
                            >
                                Huỷ
                            </button>
                            <button
                                onClick={async () => {
                                    if (!rejectModalTarget) return;
                                    const reason = rejectReason.trim();
                                    if (reason.length < 10) return;
                                    const success = await handleRejectConfirm(reason);
                                }}
                                disabled={Boolean(rejectingKey) || rejectReason.trim().length < 10}
                                className="rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {rejectingKey ? "Đang xử lý..." : "Xác nhận từ chối"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
