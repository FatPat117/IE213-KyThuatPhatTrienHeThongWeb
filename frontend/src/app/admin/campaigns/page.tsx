"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { formatEther } from "viem";
import { useAccount, useWaitForTransactionReceipt } from "wagmi";
import { updateCampaignStatus, useAuth, useBackendCampaigns } from "@/lib";
import { showErrorToast, showSuccessToast } from "@/lib/ui/toast";
import {
    useAdminApproveCampaign,
    useReadAllCampaigns,
    useReadCampaignReviewersBatch,
    useReadContractOwner,
} from "@/lib/contracts/hooks";
import { useRegisterWalletTxOverlay } from "@/context/wallet-tx-overlay";

function formatEthFromWei(wei: bigint | number | string) {
    try {
        return Number(formatEther(BigInt(wei))).toFixed(3);
    } catch {
        return "0.000";
    }
}

function getCampaignAgeDays(createdAt?: string) {
    if (!createdAt) return null;
    const ts = new Date(createdAt).getTime();
    if (Number.isNaN(ts)) return null;
    return Math.max(Math.floor((Date.now() - ts) / (24 * 60 * 60 * 1000)), 0);
}

function getRemainingDays(
    deadlineIso?: string,
    deadlineOnChain?: bigint | number,
) {
    let deadlineTs = Number.NaN;
    if (deadlineIso) {
        deadlineTs = new Date(deadlineIso).getTime();
    } else if (deadlineOnChain) {
        const normalized = Number(deadlineOnChain);
        if (Number.isFinite(normalized) && normalized > 0) {
            deadlineTs = normalized * 1000;
        }
    }
    if (Number.isNaN(deadlineTs)) return null;
    return Math.ceil((deadlineTs - Date.now()) / (24 * 60 * 60 * 1000));
}

export default function AdminCampaignApprovalsPage() {
    const { user, token } = useAuth();
    const { address } = useAccount();
    const { owner } = useReadContractOwner();
    const { campaigns, isLoading, refetch } = useReadAllCampaigns();
    const backendCampaigns = useBackendCampaigns();
    const backendRefetch = backendCampaigns.refetch;
    const { reviewersByCampaignId } = useReadCampaignReviewersBatch(campaigns.length);
    const { adminApproveCampaign, isPending } = useAdminApproveCampaign();
    const [txHash, setTxHash] = useState<`0x${string}` | undefined>(undefined);
    const [lastApprovedId, setLastApprovedId] = useState<number | null>(null);
    const [mounted, setMounted] = useState(false);
    const lastSyncedTxHashRef = useRef<`0x${string}` | undefined>(undefined);
    const lastNotifiedSuccessTxHashRef = useRef<`0x${string}` | undefined>(
        undefined,
    );
    const lastNotifiedFailureTxHashRef = useRef<`0x${string}` | undefined>(
        undefined,
    );
    const [actionError, setActionError] = useState<string | null>(null);
    const {
        isLoading: isConfirming,
        isSuccess: isConfirmed,
        isError: isConfirmError,
        error: confirmError,
        data: receipt,
    } = useWaitForTransactionReceipt({ hash: txHash });
    useRegisterWalletTxOverlay(isPending || isConfirming);

    // mounted guard: chằn SSR khỏi render phân nhánh isAdmin (tài khoản chưa có dữ liệu wallet)
    useEffect(() => { setMounted(true); }, []);

    const normalizedWallet = (address || "").toLowerCase();
    const adminWallets = (process.env.NEXT_PUBLIC_ADMIN_WALLETS || "")
        .split(",")
        .map((item) => item.trim().toLowerCase())
        .filter((item) => /^0x[a-f0-9]{40}$/.test(item));
    const isAdminByOwner = Boolean(normalizedWallet) && normalizedWallet === owner;
    const isAdminByRole = (user?.role || "").toLowerCase() === "admin";
    const isAdminByConfig = Boolean(normalizedWallet) && adminWallets.includes(normalizedWallet);
    const isAdmin = Boolean(token && (isAdminByOwner || isAdminByRole || isAdminByConfig));

    const metadataById = useMemo(() => {
        const map = new Map<
            number,
            {
                title: string;
                description?: string;
                createdAt?: string;
                deadline?: string;
                status?: string;
                goal?: string;
                raised?: string;
                milestoneCount?: number;
            }
        >();
        backendCampaigns.data.forEach((item) => {
            map.set(item.onChainId, {
                title: item.title || `Campaign #${item.onChainId}`,
                description: item.description,
                createdAt: item.createdAt,
                deadline: item.deadline,
                status: item.status,
                goal: item.goal,
                raised: item.raised,
                milestoneCount: item.milestoneCount,
            });
        });
        return map;
    }, [backendCampaigns.data]);
    const pendingItems = useMemo(
        () =>
            campaigns
                .filter((item) => item.statusLabel === "pending_approval")
                .sort((a, b) => {
                    const createdA = Date.parse(
                        metadataById.get(a.id)?.createdAt || "",
                    );
                    const createdB = Date.parse(
                        metadataById.get(b.id)?.createdAt || "",
                    );
                    if (!Number.isNaN(createdA) && !Number.isNaN(createdB)) {
                        return createdB - createdA;
                    }
                    return b.id - a.id;
                }),
        [campaigns, metadataById],
    );

    useEffect(() => {
        if (isConfirming || !txHash || txHash === lastSyncedTxHashRef.current)
            return;
        refetch();
        backendRefetch();
        lastSyncedTxHashRef.current = txHash;
    }, [backendRefetch, isConfirming, refetch, txHash]);

    useEffect(() => {
        if (
            !txHash ||
            !isConfirmed ||
            txHash === lastNotifiedSuccessTxHashRef.current
        )
            return;
        if (receipt?.status === "success") {
            showSuccessToast("Duyệt campaign thành công.");
            if (token && lastApprovedId) {
                updateCampaignStatus(lastApprovedId, token, "active")
                    .then(() => {
                        backendRefetch();
                    })
                    .catch((error) => {
                        showErrorToast(
                            error instanceof Error
                                ? error.message
                                : "Không thể đồng bộ trạng thái campaign.",
                        );
                    });
            }
            lastNotifiedSuccessTxHashRef.current = txHash;
        }
    }, [backendRefetch, isConfirmed, lastApprovedId, receipt?.status, token, txHash]);

    useEffect(() => {
        if (!txHash || txHash === lastNotifiedFailureTxHashRef.current) return;

        if (receipt?.status === "reverted") {
            const message = "Giao dịch duyệt campaign đã bị revert.";
            showErrorToast(message);
            lastNotifiedFailureTxHashRef.current = txHash;
            return;
        }

        if (isConfirmError) {
            const message =
                confirmError instanceof Error
                    ? confirmError.message
                    : "Không thể xác nhận giao dịch duyệt campaign.";
            showErrorToast(message);
            lastNotifiedFailureTxHashRef.current = txHash;
        }
    }, [confirmError, isConfirmError, receipt?.status, txHash]);

    if (!mounted) {
        return (
            <div className="min-h-screen bg-slate-50 px-6 py-10">
                <main className="mx-auto max-w-6xl rounded-2xl border border-slate-200 bg-white p-6">
                    <div className="space-y-3 animate-pulse">
                        <div className="h-7 w-40 rounded bg-slate-200" />
                        <div className="h-4 w-64 rounded bg-slate-100" />
                    </div>
                </main>
            </div>
        );
    }

    if (!isAdmin) {
        return (
            <div className="min-h-screen bg-slate-50 px-6 py-10">
                <main className="mx-auto max-w-3xl rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
                    Tài khoản hiện tại không có quyền truy cập trang quản trị campaign.
                </main>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 px-6 py-10">
            <main className="mx-auto max-w-6xl rounded-2xl border border-slate-200 bg-white p-6">
                <h1 className="text-2xl font-bold text-slate-900">Duyệt campaign</h1>
                <p className="mt-1 text-sm text-slate-600">
                    Danh sách campaign đang ở trạng thái chờ duyệt.
                </p>
                {isLoading ? <p className="mt-4 text-sm">Đang tải...</p> : null}
                {txHash && isConfirming ? (
                    <p className="mt-4 text-sm text-blue-700">
                        Đã gửi giao dịch duyệt. Đang chờ xác nhận on-chain...
                    </p>
                ) : null}
                {txHash && isConfirmed && receipt?.status === "success" ? (
                    <p className="mt-4 text-sm text-emerald-700">
                        Campaign đã được duyệt thành công.
                    </p>
                ) : null}
                {actionError ? <p className="mt-4 text-sm text-red-600">{actionError}</p> : null}
                <div className="mt-4 space-y-3">
                    {pendingItems.map((item) => (
                        <div key={item.id} className="rounded-xl border border-slate-200 p-5 hover:border-blue-200 hover:bg-blue-50/30 transition-colors">
                            <div className="flex items-start justify-between gap-4 mb-3">
                                <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-slate-900 text-base">
                                        {metadataById.get(item.id)?.title || `Campaign #${item.id}`}
                                    </p>
                                    {metadataById.get(item.id)?.description && (
                                        <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                                            {metadataById.get(item.id)?.description}
                                        </p>
                                    )}
                                </div>
                                <Link
                                    href={`/campaigns/${item.id}`}
                                    target="_blank"
                                    className="shrink-0 text-xs text-blue-600 hover:text-blue-700 hover:underline"
                                >
                                    Xem chi tiết →
                                </Link>
                            </div>
                            {(() => {
                                const metadata = metadataById.get(item.id);
                                const goalWei = metadata?.goal || "0";
                                const raisedWei = metadata?.raised || "0";
                                const goalBigInt = (() => {
                                    try {
                                        return BigInt(goalWei);
                                    } catch {
                                        return 0n;
                                    }
                                })();
                                const raisedBigInt = (() => {
                                    try {
                                        return BigInt(raisedWei);
                                    } catch {
                                        return 0n;
                                    }
                                })();
                                const remainingBigInt =
                                    goalBigInt > raisedBigInt
                                        ? goalBigInt - raisedBigInt
                                        : 0n;
                                const progress = (() => {
                                    try {
                                        const goal = Number(formatEther(goalBigInt));
                                        const raised = Number(formatEther(raisedBigInt));
                                        if (goal <= 0) return 0;
                                        return Math.min((raised / goal) * 100, 100);
                                    } catch {
                                        return 0;
                                    }
                                })();
                                const createdAt = metadata?.createdAt;
                                const ageDays = getCampaignAgeDays(createdAt);
                                const remainingDays = getRemainingDays(
                                    metadata?.deadline,
                                    item.deadline,
                                );
                                const credibilityLabel =
                                    progress >= 75
                                        ? "Uy tín cao (đã gần đủ vốn)"
                                        : progress >= 40
                                          ? "Uy tín trung bình"
                                          : "Uy tín thấp (vốn huy động còn thấp)";
                                const needsAttention = remainingDays !== null && remainingDays <= 3;
                                const isNewCampaign = ageDays !== null && ageDays <= 1;
                                const hasReviewer = Boolean(
                                    reviewersByCampaignId.get(item.id),
                                );

                                return (
                                    <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                                        <div className="mb-2 flex flex-wrap items-center gap-2">
                                            <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-700">
                                                Ưu tiên duyệt #{pendingItems.length - pendingItems.indexOf(item)}
                                            </span>
                                            {isNewCampaign && (
                                                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                                                    Campaign mới tạo
                                                </span>
                                            )}
                                            {needsAttention && (
                                                <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                                                    Gần tới hạn gọi vốn
                                                </span>
                                            )}
                                            {!hasReviewer && (
                                                <span className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-700">
                                                    Thiếu reviewer an toàn
                                                </span>
                                            )}
                                        </div>
                                        <div className="mb-2 flex items-center justify-between text-xs">
                                            <span className="font-medium text-slate-700">Tiến độ gây quỹ</span>
                                            <span className="font-semibold text-slate-900">
                                                {progress.toFixed(1)}%
                                            </span>
                                        </div>
                                        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                                            <div
                                                className="h-full rounded-full bg-emerald-500 transition-all"
                                                style={{ width: `${Math.max(2, progress)}%` }}
                                            />
                                        </div>
                                        <div className="mt-2 grid gap-1 text-[11px] text-slate-600 sm:grid-cols-2">
                                            <p>Đánh giá nhanh: {credibilityLabel}</p>
                                            <p className="sm:text-right">
                                                Còn thiếu {formatEthFromWei(remainingBigInt)} ETH để chạm mục tiêu
                                            </p>
                                        </div>
                                    </div>
                                );
                            })()}
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-600 mb-3">
                                <p>
                                    <span className="font-medium">Người tạo:</span>{" "}
                                    <a
                                        href={`https://sepolia.etherscan.io/address/${item.creator}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="font-mono text-blue-600 hover:underline"
                                    >
                                        {item.creator.slice(0, 8)}...{item.creator.slice(-6)}
                                    </a>
                                </p>
                                <p>
                                    <span className="font-medium">Mục tiêu:</span>{" "}
                                    {formatEthFromWei(item.goal)} ETH
                                </p>
                                <p>
                                    <span className="font-medium">Đã huy động:</span>{" "}
                                    {formatEthFromWei(item.raised)} ETH
                                </p>
                                <p>
                                    <span className="font-medium">Còn thiếu:</span>{" "}
                                    {(() => {
                                        try {
                                            const remaining = item.goal - item.raised;
                                            return formatEthFromWei(
                                                remaining > 0n ? remaining : 0n,
                                            );
                                        } catch {
                                            return "0.000";
                                        }
                                    })()}{" "}
                                    ETH
                                </p>
                                <p>
                                    <span className="font-medium">Tuổi campaign:</span>{" "}
                                    {(() => {
                                        const days = getCampaignAgeDays(
                                            metadataById.get(item.id)?.createdAt,
                                        );
                                        if (days === null) return "-";
                                        if (days === 0) return "Hôm nay";
                                        return `${days} ngày`;
                                    })()}
                                </p>
                                <p>
                                    <span className="font-medium">Còn lại tới deadline:</span>{" "}
                                    {(() => {
                                        const days = getRemainingDays(
                                            metadataById.get(item.id)?.deadline,
                                            item.deadline,
                                        );
                                        if (days === null) return "-";
                                        if (days < 0) return "Đã quá hạn";
                                        return `${days} ngày`;
                                    })()}
                                </p>
                                <p>
                                    <span className="font-medium">Milestone:</span>{" "}
                                    {metadataById.get(item.id)?.milestoneCount ?? item.milestoneCount}
                                </p>
                                <p>
                                    <span className="font-medium">Đang ở mốc:</span>{" "}
                                    {item.currentMilestoneId + 1}/{item.milestoneCount}
                                </p>
                                <p className="col-span-2">
                                    <span className="font-medium">Reviewer:</span>{" "}
                                    {reviewersByCampaignId.get(item.id)
                                        ? (
                                            <a
                                                href={`https://sepolia.etherscan.io/address/${reviewersByCampaignId.get(item.id)}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="font-mono text-violet-600 hover:underline"
                                            >
                                                {(reviewersByCampaignId.get(item.id) || "").slice(0, 8)}...{(reviewersByCampaignId.get(item.id) || "").slice(-6)}
                                            </a>
                                        )
                                        : <span className="text-slate-400">Chưa có</span>
                                    }
                                </p>
                                <p className="col-span-2">
                                    <span className="font-medium">Hạn gọi vốn:</span>{" "}
                                    <span suppressHydrationWarning>
                                        {metadataById.get(item.id)?.deadline
                                            ? new Date(
                                                  metadataById.get(item.id)?.deadline || "",
                                              ).toLocaleString("vi-VN")
                                            : item.deadline > 0
                                              ? new Date(
                                                    Number(item.deadline) * 1000,
                                                ).toLocaleString("vi-VN")
                                              : "-"}
                                    </span>
                                </p>
                                <p className="col-span-2">
                                    <span className="font-medium">Thời gian tạo:</span>{" "}
                                    <span suppressHydrationWarning>
                                        {metadataById.get(item.id)?.createdAt
                                            ? new Date(
                                                  metadataById.get(item.id)?.createdAt || "",
                                              ).toLocaleString("vi-VN")
                                            : "-"}
                                    </span>
                                </p>
                            </div>
                            <button
                                type="button"
                                disabled={isPending || isConfirming}
                                className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                                onClick={async () => {
                                    try {
                                        setActionError(null);
                                        const hash = await adminApproveCampaign(item.id);
                                        setLastApprovedId(item.id);
                                        setTxHash(hash as `0x${string}`);
                                    } catch (error) {
                                        setActionError(
                                            error instanceof Error
                                                ? error.message
                                                : "Không thể duyệt campaign",
                                        );
                                    }
                                }}
                            >
                                {isPending || isConfirming ? "Đang xử lý..." : "Duyệt campaign"}
                            </button>
                        </div>
                    ))}
                    {!isLoading && pendingItems.length === 0 ? (
                        <p className="text-sm text-slate-500">Không có campaign chờ duyệt.</p>
                    ) : null}
                </div>
            </main>
        </div>
    );
}
