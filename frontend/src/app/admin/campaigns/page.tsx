"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { formatEther } from "viem";
import { useAccount, usePublicClient } from "wagmi";
import { useAuth, useBackendCampaigns } from "@/lib";
import { getWalletErrorMessage } from "@/lib/errors/normalize";
import {
    useReadAllCampaigns,
    useReadCampaignReviewersBatch,
    useReadContractOwner,
} from "@/lib/contracts/hooks";
import { useRegisterWalletTxOverlay } from "@/context/wallet-tx-overlay";
import { useOwnerSafes } from "@/lib/hooks/use-owner-safes";
import { useAdminApprove } from "@/lib/contracts/hooks";

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
    const { token } = useAuth();
    const { address } = useAccount();
    const publicClient = usePublicClient();

    // Hooks
    const { isAdminOnChain, isLoading: isCheckingAdminPermission } =
        useReadContractOwner();
    const { isLoading: isLoadingOwnerSafes } = useOwnerSafes();
    const { adminApprove: directApprove } = useAdminApprove();

    const { campaigns, isLoading: isLoadingCampaigns, refetch } = useReadAllCampaigns();
    const backendCampaigns = useBackendCampaigns();
    const backendRefetch = backendCampaigns.refetch;
    const { reviewersByCampaignId } = useReadCampaignReviewersBatch(campaigns.length);

    const [mounted, setMounted] = useState(false);
    const [actionError, setActionError] = useState<string | null>(null);
    const [actionMessage, setActionMessage] = useState<string | null>(null);
    const [isCancelMessage, setIsCancelMessage] = useState(false);
    const [activeCampaignId, setActiveCampaignId] = useState<number | null>(null);
    const [lastApprovedCampaignId, setLastApprovedCampaignId] = useState<number | null>(null);

    useEffect(() => { setMounted(true); }, []);

    const isAdmin = Boolean(token && isAdminOnChain);
    const isAccessChecking =
        !mounted || isCheckingAdminPermission || isLoadingOwnerSafes;

    // Lấy metadata từ backend
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

    // Lọc campaigns pending approval
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
        if (!activeCampaignId) {
            return;
        }
        const onBeforeUnload = (event: BeforeUnloadEvent) => {
            event.preventDefault();
            event.returnValue = "";
        };
        window.addEventListener("beforeunload", onBeforeUnload);
        return () => {
            window.removeEventListener("beforeunload", onBeforeUnload);
        };
    }, [activeCampaignId]);

    if (isAccessChecking) {
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
                    <h2 className="text-lg font-bold">Không có quyền truy cập</h2>
                    <p className="mt-2">
                        Tài khoản hiện tại không có quyền truy cập trang quản trị campaign.
                    </p>
                    <div className="mt-4 space-y-1 text-xs text-slate-500">
                        <p>Wallet: {address ? `${address.slice(0, 10)}...` : "Chưa connect"}</p>
                        <p>On-chain Admin: {isAdminOnChain ? "✅ Đã xác thực" : "❌ Chưa có quyền"}</p>
                    </div>
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

                {isLoadingOwnerSafes && (
                    <p className="mt-2 text-xs text-slate-500">
                        Đang kiểm tra quyền Safe...
                    </p>
                )}

                {actionMessage && !isCancelMessage && (
                    <div className="mt-4 rounded-lg bg-emerald-50 border border-emerald-200 p-4 text-emerald-800">
                        {actionMessage}
                    </div>
                )}

                {actionError && (
                    <div
                        className={`mt-4 rounded-lg border p-4 ${
                            isCancelMessage
                                ? "border-amber-200 bg-amber-50 text-amber-800"
                                : "border-red-200 bg-red-50 text-red-700"
                        }`}
                    >
                        {actionError}
                    </div>
                )}

                {activeCampaignId !== null && (
                    <div className="mt-4 rounded-lg bg-blue-50 border border-blue-200 p-4 text-blue-800">
                        <div className="flex items-center gap-2">
                            <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span>
                                Đã gửi giao dịch duyệt lên blockchain. Vui lòng chờ MetaMask xác nhận xong trước khi tải lại trang.
                            </span>
                        </div>
                    </div>
                )}

                {isLoadingCampaigns ? (
                    <p className="mt-4 text-sm">Đang tải campaigns...</p>
                ) : (
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
                                    disabled={
                                        activeCampaignId === item.id
                                    }
                                    className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    onClick={async () => {
                                        try {
                                            setIsCancelMessage(false);
                                            setActionError(null);
                                            setActionMessage(null);
                                            setActiveCampaignId(item.id);
                                            setLastApprovedCampaignId(null);

                                            if (isAdminOnChain) {
                                                const txHash = await directApprove(item.id);
                                                setActionMessage("Đã gửi giao dịch duyệt. Đang chờ xác nhận on-chain...");
                                                if (publicClient) {
                                                    await publicClient.waitForTransactionReceipt({
                                                        hash: txHash,
                                                        confirmations: 1,
                                                    });
                                                }
                                                await Promise.all([
                                                    refetch(),
                                                    backendRefetch(),
                                                ]);
                                                setLastApprovedCampaignId(item.id);
                                                setActionMessage(`✅ Duyệt campaign #${item.id} thành công!`);
                                            } else {
                                                throw new Error("Ví của bạn không có quyền ADMIN_ROLE trực tiếp. Vui lòng sử dụng ví Admin hoặc Safe Admin.");
                                            }
                                        } catch (error) {
                                            console.error("Admin approve error:", error);
                                            const normalizedMessage = getWalletErrorMessage(
                                                error,
                                                { fallback: "Không thể duyệt campaign." },
                                            );
                                            const isCancelledByUser =
                                                normalizedMessage === "Bạn đã hủy thao tác trong MetaMask.";
                                            setIsCancelMessage(isCancelledByUser);
                                            setActionError(normalizedMessage);
                                        } finally {
                                            setActiveCampaignId(null);
                                        }
                                    }}
                                >
                                    {activeCampaignId === item.id
                                        ? "Đang xử lý..."
                                        : lastApprovedCampaignId === item.id
                                            ? "Đã duyệt ✓"
                                            : "Duyệt chiến dịch"}
                                </button>
                            </div>
                        ))}
                        {!isLoadingCampaigns && pendingItems.length === 0 && (
                            <p className="text-sm text-slate-500">Không có campaign chờ duyệt.</p>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
}
