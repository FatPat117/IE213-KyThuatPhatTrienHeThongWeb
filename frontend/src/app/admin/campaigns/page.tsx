"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { formatEther, getAddress } from "viem";
import { useAccount, usePublicClient } from "wagmi";
import { updateCampaignStatus, useAuth, useBackendCampaigns } from "@/lib";
import { showErrorToast, showSuccessToast } from "@/lib/ui/toast";
import {
    useReadAllCampaigns,
    useReadCampaignReviewersBatch,
    useReadContractOwner,
} from "@/lib/contracts/hooks";
import { useRegisterWalletTxOverlay } from "@/context/wallet-tx-overlay";
import { useOwnerSafes } from "@/lib/hooks/use-owner-safes";
import { useProposeSafeTransaction, useAdminApprove } from "@/lib/contracts/hooks";
import { CROWDFUNDING_CONTRACT_ADDRESS, contractConfig } from "@/lib/contracts/config";

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
    const publicClient = usePublicClient();

    // Hooks
    const { isAdminOnChain } = useReadContractOwner();
    const { safes: ownerSafes, isLoading: isLoadingOwnerSafes } = useOwnerSafes();
    const { propose: proposeAdminViaSafe } = useProposeSafeTransaction();
    const { adminApprove: directApprove } = useAdminApprove();

    const [isProposing, setIsProposing] = useState(false);

    const { campaigns, isLoading: isLoadingCampaigns, refetch } = useReadAllCampaigns();
    const backendCampaigns = useBackendCampaigns();
    const backendRefetch = backendCampaigns.refetch;
    const { reviewersByCampaignId } = useReadCampaignReviewersBatch(campaigns.length);

    const [mounted, setMounted] = useState(false);
    const [actionError, setActionError] = useState<string | null>(null);
    const [actionMessage, setActionMessage] = useState<string | null>(null);
    const [lastProposedTx, setLastProposedTx] = useState<{ safeTxHash: string; safeUiUrl: string; campaignId: number; safeAddress: string } | null>(null);
    const [txStatus, setTxStatus] = useState<"idle" | "proposed" | "executed" | "failed">("idle");

    // Polling reference để cleanup
    const pollingRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => { setMounted(true); }, []);

    const isAdmin = Boolean(token && isAdminOnChain);

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

    // Polling Safe API để check transaction status via queue
    useEffect(() => {
        if (!lastProposedTx?.safeTxHash || !lastProposedTx?.safeAddress) return;

        let mounted = true;
        let attempts = 0;
        const MAX_ATTEMPTS = 30; // 30 lần * 2s = 60s max

        const checkStatus = async () => {
            if (!mounted) return;

            attempts++;
            try {
                const safeAddress = getAddress(lastProposedTx.safeAddress);
                const safeTxHash = lastProposedTx.safeTxHash;
                // Query all transactions and filter by safeTxHash
                const url = `https://api.safe.global/tx-service/sep/api/v1/safes/${safeAddress}/multisig-transactions/`;

                const response = await fetch(url);
                if (!response.ok) {
                    throw new Error(`Safe API error: ${response.status}`);
                }

                const data = await response.json();

                if (!mounted) return;

                console.log('[AdminPage] Safe queue response:', data);

                // Safe API returns { results: [...] } or direct array
                const transactions = Array.isArray(data) ? data : (data.results || []);

                // Find our transaction by safeTxHash
                const ourTx = transactions.find((tx: any) =>
                    tx.safeTxHash === safeTxHash ||
                    tx.contractTransactionHash === safeTxHash
                );

                if (ourTx) {
                    console.log('[AdminPage] Found transaction in queue:', ourTx);

                    if (ourTx.executionDate || ourTx.executed) {
                        // Transaction executed (executionDate indicates it's been executed)
                        setTxStatus("executed");
                        setActionMessage("✅ Duyệt campaign thành công!");
                        refetch();
                        backendRefetch();

                        // Clear sau 3s
                        setTimeout(() => {
                            if (mounted) {
                                setLastProposedTx(null);
                                setTxStatus("idle");
                            }
                        }, 3000);
                    } else if (ourTx.failed) {
                        setTxStatus("failed");
                        setActionError("Giao dịch thất bại trên Safe.");
                        setLastProposedTx(null);
                    } else {
                        // Still pending (needs more confirmations or execution)
                        if (mounted && attempts < MAX_ATTEMPTS) {
                            pollingRef.current = setTimeout(checkStatus, 2000);
                        } else if (mounted) {
                            setTxStatus("failed");
                            setActionError("Quá thời gian chờ. Vui lòng kiểm tra trên Safe UI.");
                            setLastProposedTx(null);
                        }
                    }
                } else {
                    // Transaction not found in queue yet? Continue polling
                    if (mounted && attempts < MAX_ATTEMPTS) {
                        pollingRef.current = setTimeout(checkStatus, 2000);
                    } else if (mounted) {
                        setTxStatus("failed");
                        setActionError("Không tìm thấy giao dịch trong queue. Vui lòng kiểm tra trên Safe UI.");
                        setLastProposedTx(null);
                    }
                }
            } catch (error) {
                console.error('[AdminPage] Error polling Safe transaction:', error);
                if (mounted && attempts < MAX_ATTEMPTS) {
                    pollingRef.current = setTimeout(checkStatus, 5000);
                } else if (mounted) {
                    setTxStatus("failed");
                    setActionError("Không thể kiểm tra trạng thái giao dịch.");
                    setLastProposedTx(null);
                }
            }
        };

        // Bắt đầu poll ngay lập tức
        checkStatus();

        return () => {
            mounted = false;
            if (pollingRef.current) {
                clearTimeout(pollingRef.current);
            }
        };
    }, [lastProposedTx?.safeTxHash, lastProposedTx?.safeAddress, refetch, backendRefetch]);

    // Cleanup khi unmount
    useEffect(() => {
        return () => {
            if (pollingRef.current) {
                clearTimeout(pollingRef.current);
            }
        };
    }, []);

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

                {actionMessage && txStatus === "executed" && (
                    <div className="mt-4 rounded-lg bg-emerald-50 border border-emerald-200 p-4 text-emerald-800">
                        {actionMessage}
                        {lastProposedTx && (
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
                                <span className="text-xs opacity-75 font-mono">
                                    Tx: {lastProposedTx.safeTxHash.slice(0, 12)}...{lastProposedTx.safeTxHash.slice(-6)}
                                </span>
                            </div>
                        )}
                    </div>
                )}

                {actionError && (
                    <div className="mt-4 rounded-lg bg-red-50 border border-red-200 p-4 text-red-700">
                        {actionError}
                    </div>
                )}

                {txStatus === "proposed" && (
                    <div className="mt-4 rounded-lg bg-blue-50 border border-blue-200 p-4 text-blue-800">
                        <div className="flex items-center gap-2">
                            <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span>
                                Đã gửi đề xuất đến Safe. Threshold = 1 nên sẽ tự động execute sau khi đủ chữ ký...
                            </span>
                        </div>
                        {lastProposedTx && (
                            <div className="mt-2">
                                <a
                                    href={lastProposedTx.safeUiUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sm underline"
                                >
                                    Xem transaction trên Safe UI
                                </a>
                            </div>
                        )}
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
                                    disabled={isProposing || txStatus === "proposed" || txStatus === "executed"}
                                    className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    onClick={async () => {
                                        try {
                                            setActionError(null);
                                            setActionMessage(null);
                                            setLastProposedTx(null);
                                            setTxStatus("proposed");
                                            setIsProposing(true);

                                            // 1. Kiểm tra xem người dùng có muốn dùng Safe không, hoặc là admin trực tiếp
                                            // Nếu walletAddress có ADMIN_ROLE và KHÔNG phải là Safe (hoặc đơn giản là muốn duyệt nhanh)
                                            // Ở đây ta ưu tiên duyệt trực tiếp nếu có quyền.

                                            if (isAdminOnChain) {
                                                console.log("[AdminPage] Detected ADMIN_ROLE on-chain, attempting direct approval...");
                                                const tx = await directApprove(item.id);
                                                setActionMessage("✅ Đã gửi lệnh duyệt trực tiếp! Đang chờ confirm...");
                                                setTxStatus("executed"); // Hoặc "idle" tùy bạn muốn xử lý hash
                                                refetch();
                                                backendRefetch();
                                            } else {
                                                // Fallback: Propose qua Safe nếu không có quyền admin trực tiếp nhưng có thể là owner của Safe admin
                                                // TODO: Cần biết address của Safe admin. Hiện tại lấy từ config hoặc input?
                                                // Giả sử có một cơ chế chọn Safe.
                                                throw new Error("Ví của bạn không có quyền ADMIN_ROLE trực tiếp. Vui lòng sử dụng ví Admin hoặc Safe Admin.");
                                            }
                                        } catch (error) {
                                            console.error("Admin approve error:", error);
                                            setTxStatus("failed");
                                            setActionError(
                                                error instanceof Error
                                                    ? error.message
                                                    : "Không thể duyệt campaign"
                                            );
                                            setLastProposedTx(null);
                                        } finally {
                                            setIsProposing(false);
                                        }
                                    }}
                                >
                                    {isProposing || txStatus === "proposed"
                                        ? "Đang xử lý..."
                                        : txStatus === "executed"
                                            ? "Đã duyệt ✓"
                                            : "Duyệt campaign"}
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
