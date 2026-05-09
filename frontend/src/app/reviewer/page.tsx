"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
    submitted: "bg-amber-100 text-amber-800 border-amber-200",
    pending_verification: "bg-sky-100 text-sky-800 border-sky-200",
    resubmittable: "bg-orange-100 text-orange-800 border-orange-200",
    approved: "bg-emerald-100 text-emerald-800 border-emerald-200",
    disbursed: "bg-amber-100 text-amber-800 border-amber-200",
    disbursed_done: "bg-teal-100 text-teal-800 border-teal-200",
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
        return "✅ Đã được phê duyệt";
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

    const canWalletApproveMilestone =
        isActionable &&
        hasOnChainProof &&
        !hasSigned &&
        myReviewerSafes.includes(campaignReviewerSafe);

    const canWalletRejectMilestone =
        isActionable &&
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
                                className="rounded-xl border border-blue-100 bg-white p-3 shadow-sm ring-1 ring-blue-50/50"
                            >
                                <div className="flex items-center justify-between gap-2 mb-1.5">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                                        Minh chứng #{index + 1}
                                    </span>
                                    <span className="text-[10px] text-slate-400 font-medium">On-chain</span>
                                </div>
                                <p className="text-xs font-semibold text-slate-600">CID</p>
                                <p className="mt-1 break-all text-[11px] font-mono text-slate-700 leading-relaxed bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                                    {cid}
                                </p>
                                <a
                                    href={`https://ipfs.io/ipfs/${cid}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="mt-2.5 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50 hover:border-slate-300"
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
                            <span className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-100 px-5 py-2.5 text-sm font-bold text-emerald-700 ring-1 ring-emerald-200">
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
                                        !hasOnChainProof ||
                                        !canWalletApproveMilestone ||
                                        isLoadingOnChain
                                    }
                                    title={
                                        isLoadingOnChain
                                            ? "Đang kiểm tra dữ liệu on-chain..."
                                            : !hasOnChainProof
                                                ? "Chưa có minh chứng trên Smart Contract"
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
                                    ) : (
                                        "Phê duyệt mốc"
                                    )}
                                </button>

                                <button
                                    onClick={() => handleReject(campaignId, milestone.milestoneId)}
                                    disabled={
                                        isApproving ||
                                        isRejecting ||
                                        !canWalletRejectMilestone
                                    }
                                    title={
                                        !myReviewerSafes.includes(campaignReviewerSafe)
                                            ? "Ví không nằm trong danh sách reviewer của campaign"
                                            : milestone.status === "resubmittable"
                                                ? "Đã từ chối, đang chờ Creator nộp lại minh chứng"
                                            : !isPendingMilestone
                                                ? "Mốc không ở trạng thái chờ duyệt"
                                                : undefined
                                    }
                                    className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-6 py-2.5 text-sm font-bold text-rose-700 transition hover:bg-rose-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {isRejecting ? "Đang xử lý..." : "Từ chối mốc"}
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
                                    !canExecute ||
                                    isLoadingOnChain
                                }
                                title={
                                    isLoadingOnChain
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
    const [lastProposedTx, setLastProposedTx] = useState<{ safeTxHash: string; safeUiUrl: string } | null>(null);

    // Use new hook that fetches campaigns based on Safe API
    const { rows, myReviewerSafes, isLoading, error, lastUpdatedAt, refresh } = useReviewerCampaigns();
    const { safes: ownerSafes } = useOwnerSafes();

    const [approvingKey, setApprovingKey] = useState<string | null>(null);
    const [rejectingKey, setRejectingKey] = useState<string | null>(null);
    const [executingKey, setExecutingKey] = useState<string | null>(null);
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
    useRegisterWalletTxOverlay(Boolean(approvingKey));
    useRegisterWalletTxOverlay(isConfirming);

    // Initialize execute hook
    const { execute: executeSafeTransaction, isPending: isExecuting } = useExecuteSafeTransaction();

    // Check if user has reviewer access (has at least one registered safe)
    const hasReviewerAccess = myReviewerSafes.length > 0;

    const refreshApprovalStatuses = useCallback(async (forceRefresh = false) => {
        if (!token || rows.length === 0) return;

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
                    const existingStatus = approvalStatusMap[key];

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
            for (const result of statusResults) {
                if (result.status !== "fulfilled") continue;
                next[result.value.key] = result.value.data;
            }
            return next;
        });
    }, [rows, token, approvalStatusMap]);

    useEffect(() => {
        // Initial load is handled by useReviewerCampaigns hook
    }, []);

    useEffect(() => {
        if (!hasReviewerAccess || rows.length === 0) return;

        refreshApprovalStatuses();
        const timer = window.setInterval(() => {
            refreshApprovalStatuses();
        }, 20_000); // 20 seconds (reduced from 2m for better responsiveness)

        return () => window.clearInterval(timer);
    }, [hasReviewerAccess, refreshApprovalStatuses, rows.length]);

    // Force refresh when window regains focus (useful after signing in Safe tab)
    useEffect(() => {
        if (!hasReviewerAccess) return;
        const handleFocus = () => {
            console.log('[ReviewerPage] Window focused, triggering refresh...');
            refreshApprovalStatuses(true);
        };
        window.addEventListener('focus', handleFocus);
        return () => window.removeEventListener('focus', handleFocus);
    }, [hasReviewerAccess, refreshApprovalStatuses]);

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
        ]);
        const connect = async () => {
            try {
                await openNotificationStream(
                    token,
                    (notification) => {
                        if (!active) return;
                        if (RELOAD_TYPES.has(notification.type)) {
                            refresh();
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
        };
    }, [token, walletAddress, refresh]);

    // Handle transaction receipt after execute
    useEffect(() => {
        if (!txHash) return;

        if (isTxSuccess) {
            setActionIsSuccess(true);
            setActionMessage("✅ Giao dịch đã được thực thi thành công!");
            refreshApprovalStatuses(true);
            // Refetch campaigns after delay to show updated milestone status
            setTimeout(() => {
                refresh();
            }, 3000);
            setTxHash(undefined);
            setExecutingKey(null);
            return;
        }

        if (isTxError) {
            setActionIsSuccess(false);
            setActionMessage(
                txError instanceof Error
                    ? txError.message
                    : "Thực thi giao dịch thất bại."
            );
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
            setLastProposedTx(null);

            try {
                console.log('[handleApprove] Calling proposeSafeTx with:', { campaignId, milestoneId, safe: campaignReviewerSafe });
                // Propose transaction FROM the Safe address (not the wallet)
                const result = await proposeSafeTx(campaignId, milestoneId, campaignReviewerSafe as `0x${string}`);
                console.log('[handleApprove] Proposal SUCCESS:', result);
                setActionIsSuccess(true);
                setActionMessage(`✅ ${result.message}`);
                setLastProposedTx({ safeTxHash: result.safeTxHash, safeUiUrl: result.safeUiUrl });

                // Open Safe UI in new tab so reviewer can see and continue signing
                window.open(result.safeUiUrl, '_blank');

                await refreshApprovalStatuses(true);
                // Reload campaigns after a short delay
                window.setTimeout(() => {
                    refresh();
                }, 3000);
            } catch (error) {
                console.error('[handleApprove] ERROR:', error);
                setActionIsSuccess(false);
                setActionMessage(
                    error instanceof Error
                        ? error.message
                        : "Không thể đề xuất giao dịch Safe phê duyệt",
                );
                setLastProposedTx(null);
            } finally {
                setApprovingKey(null);
            }
        },
        [proposeSafeTx, isConnected, refresh, refreshApprovalStatuses, rows, walletAddress, myReviewerSafes],
    );

    const openRejectModal = useCallback(
        (campaignId: number, milestoneId: number) => {
            if (!isConnected || !walletAddress) {
                setActionIsSuccess(false);
                setActionMessage("Vui lòng kết nối ví để gửi từ chối.");
                setLastProposedTx(null);
                return;
            }
            if (!token) {
                setActionIsSuccess(false);
                setActionMessage("Bạn cần đăng nhập để gửi từ chối milestone.");
                setLastProposedTx(null);
                return;
            }
            const campaignRow = rows.find((item) => item.campaign.onChainId === campaignId);
            const campaignReviewerSafe = campaignRow?.campaign.reviewerSafe?.trim().toLowerCase() || "";
            if (!campaignReviewerSafe) {
                setActionIsSuccess(false);
                setActionMessage("Chiến dịch chưa có reviewerSafe nên không thể gửi từ chối on-chain.");
                setLastProposedTx(null);
                return;
            }
            // Check if this Safe is owned by the reviewer
            if (!myReviewerSafes.includes(campaignReviewerSafe)) {
                setActionIsSuccess(false);
                setActionMessage("Safe address của chiến dịch này không nằm trong danh sách Safe bạn được gán làm reviewer.");
                setLastProposedTx(null);
                return;
            }
            setRejectModalTarget({ campaignId, milestoneId });
            setActionMessage(null);
            setLastProposedTx(null);
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
                await rejectMilestone(campaignId, milestoneId, token, reason);
                setActionIsSuccess(true);
                setActionMessage("✅ Đã ghi nhận từ chối milestone. Creator đã được thông báo.");
                await refresh();
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
                setActionMessage(
                    error instanceof Error
                        ? error.message
                        : "Không thể thực thi giao dịch. Vui lòng thử lại."
                );
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
                                <span className={`rounded-full px-4 py-1 text-xs font-bold ${hasReviewerAccess ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                                    {hasReviewerAccess
                                        ? "Đã có quyền reviewer"
                                        : "Chế độ chỉ xem dữ liệu"}
                                </span>
                            </div>

                            <h1 className="mt-4 text-3xl font-extrabold leading-[1.15] tracking-tight text-slate-900 md:text-[3.2rem]">
                                Các mốc đang chờ bạn phê duyệt
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
                                    Số ví Safe được gán làm kiểm duyệt viên:{" "}
                                    {myReviewerSafes.length}
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
                                    onClick={refresh}
                                    disabled={isLoading}
                                    className="rounded-2xl border border-slate-300 bg-white px-6 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-100 disabled:opacity-60"
                                >
                                    {isLoading
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
                                        className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${filter === option.value
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

                    {!hasReviewerAccess && (
                        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                            Tài khoản hiện tại chưa có quyền kiểm duyệt on-chain.
                            Bạn chỉ có thể xem dữ liệu.
                        </div>
                    )}

                    {error && (
                        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                            {error}
                        </div>
                    )}
                </header>

                <div className="h-px w-full bg-slate-200/80" />

                {lastUpdatedAt && (
                    <p className="px-1 text-xs font-medium text-slate-500">
                        Cập nhật lúc: {lastUpdatedAt}
                    </p>
                )}

                {actionMessage && (
                    <div className={`mb-4 rounded-2xl border px-4 py-3 text-sm ${actionIsSuccess ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-blue-200 bg-blue-50 text-blue-700"}`}>
                        {actionMessage}
                        {lastProposedTx && actionIsSuccess && (
                            <div className="mt-3 flex flex-wrap items-center gap-3">
                                <a
                                    href={lastProposedTx.safeUiUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                    </svg>
                                    Xem trên Safe UI
                                </a>
                                <span className="text-xs opacity-75">
                                    Tx: {lastProposedTx.safeTxHash.slice(0, 12)}...{lastProposedTx.safeTxHash.slice(-6)}
                                </span>
                            </div>
                        )}
                    </div>
                )}

                {filteredRows.length === 0 && !isLoading && (
                    <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center text-slate-600 shadow-sm">
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

                                        // Check if current wallet has already signed this milestone
                                        const hasSigned = approvalStatus.signers?.some(
                                            (signer) =>
                                                signer.toLowerCase() === walletAddress.toLowerCase()
                                        ) || false;

                                        const campaignReviewerSafe = row.campaign.reviewerSafe?.trim().toLowerCase() || "";

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
                                                                {milestone.milestoneId}
                                                            </span>
                                                            <span
                                                                className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${STATUS_BADGE[milestone.status] || "bg-slate-100 text-slate-700 border-slate-200"}`}
                                                            >
                                                                {STATUS_LABELS[milestone.status] || milestone.status}
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
                                                        milestone.approvedAt,
                                                    )}
                                                </div>

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
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            disabled={Boolean(rejectingKey)}
                            rows={4}
                            placeholder="Ví dụ: Bằng chứng chưa đủ rõ ràng, cần bổ sung hình ảnh hoàn công và tài liệu kiểm tra..."
                            className={`w-full resize-none rounded-xl border bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-100 disabled:opacity-60 ${rejectError ? "border-rose-400 focus:border-rose-500" : "border-slate-200 focus:border-indigo-400"}`}
                        />
                        {rejectError && (
                            <p className="mt-2 text-xs font-bold text-rose-600">
                                ⚠️ {rejectError}
                            </p>
                        )}
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
                                className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                            >
                                Huỷ
                            </button>
                            <button
                                onClick={async () => {
                                    if (!rejectModalTarget) return;
                                    const reason = rejectReason.trim();
                                    if (reason.length < 10) return;
                                    const success = await handleRejectConfirm(reason);
                                    if (success) {
                                        setRejectModalTarget(null);
                                        setRejectReason("");
                                        setRejectError(null);
                                    }
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
