"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatEther } from "viem";
import { useAccount, useWaitForTransactionReceipt } from "wagmi";
import { useAuth, useBackendCampaigns } from "@/lib";
import { showErrorToast, showSuccessToast } from "@/lib/ui/toast";
import {
    useAdminApproveCampaign,
    useReadAllCampaigns,
    useReadCampaignReviewersBatch,
    useReadContractOwner,
} from "@/lib/contracts/hooks";
import { useRegisterWalletTxOverlay } from "@/context/wallet-tx-overlay";

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

    const normalizedWallet = (address || "").toLowerCase();
    const adminWallets = (process.env.NEXT_PUBLIC_ADMIN_WALLETS || "")
        .split(",")
        .map((item) => item.trim().toLowerCase())
        .filter((item) => /^0x[a-f0-9]{40}$/.test(item));
    const isAdminByOwner = Boolean(normalizedWallet) && normalizedWallet === owner;
    const isAdminByRole = (user?.role || "").toLowerCase() === "admin";
    const isAdminByConfig = Boolean(normalizedWallet) && adminWallets.includes(normalizedWallet);
    const isAdmin = Boolean(token && (isAdminByOwner || isAdminByRole || isAdminByConfig));

    const pendingItems = useMemo(
        () => campaigns.filter((item) => item.statusLabel === "pending_approval"),
        [campaigns],
    );
    const metadataById = useMemo(() => {
        const map = new Map<number, { title: string; createdAt?: string }>();
        backendCampaigns.data.forEach((item) => {
            map.set(item.onChainId, {
                title: item.title || `Campaign #${item.onChainId}`,
                createdAt: item.createdAt,
            });
        });
        return map;
    }, [backendCampaigns.data]);

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
            lastNotifiedSuccessTxHashRef.current = txHash;
        }
    }, [isConfirmed, receipt?.status, txHash]);

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
                        <div key={item.id} className="rounded-xl border border-slate-200 p-4">
                            <p className="font-semibold">
                                {metadataById.get(item.id)?.title || `Campaign #${item.id}`}
                            </p>
                            <p className="text-xs text-slate-600">Người tạo: {item.creator}</p>
                            <p className="text-xs text-slate-600">
                                Mục tiêu: {Number(formatEther(item.goal)).toFixed(3)} ETH
                            </p>
                            <p className="text-xs text-slate-600">
                                Reviewer: {reviewersByCampaignId.get(item.id) || "-"}
                            </p>
                            <p className="text-xs text-slate-600">
                                Thời gian tạo:{" "}
                                {metadataById.get(item.id)?.createdAt
                                    ? new Date(
                                          metadataById.get(item.id)?.createdAt || "",
                                      ).toLocaleString("vi-VN")
                                    : "-"}
                            </p>
                            <button
                                type="button"
                                disabled={isPending || isConfirming}
                                className="mt-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white"
                                onClick={async () => {
                                    try {
                                        setActionError(null);
                                        const hash = await adminApproveCampaign(item.id);
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
                                Duyệt campaign
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
