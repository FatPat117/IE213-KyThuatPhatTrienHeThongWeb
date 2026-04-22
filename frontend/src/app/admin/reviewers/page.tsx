"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { useAuth } from "@/lib";
import {
    useAddReviewerSafe,
    useReadAllCampaigns,
    useReadCampaignReviewersBatch,
    useReadContractOwner,
    useReadReviewerSafes,
    useRemoveReviewerSafe,
} from "@/lib/contracts/hooks";
import { useWaitForTransactionReceipt } from "wagmi";
import { useRegisterWalletTxOverlay } from "@/context/wallet-tx-overlay";

export default function AdminReviewersPage() {
    const { token, user } = useAuth();
    const { address } = useAccount();
    const { owner } = useReadContractOwner();
    const [newSafe, setNewSafe] = useState("");
    const [txHash, setTxHash] = useState<`0x${string}` | undefined>(undefined);
    const { reviewerSafes, refetch } = useReadReviewerSafes();
    const { campaigns } = useReadAllCampaigns();
    const { reviewersByCampaignId } = useReadCampaignReviewersBatch(campaigns.length);
    const { addReviewerSafe } = useAddReviewerSafe();
    const { removeReviewerSafe } = useRemoveReviewerSafe();
    const { isLoading: isConfirming } = useWaitForTransactionReceipt({ hash: txHash });
    useRegisterWalletTxOverlay(isConfirming);
    const [safeMetaByAddress, setSafeMetaByAddress] = useState<
        Record<string, { threshold: number | null; ownerCount: number | null }>
    >({});
    const normalizedReviewerSafes = useMemo(
        () =>
            Array.from(
                new Set(
                    reviewerSafes
                        .map((item) => item.toLowerCase())
                        .filter((item) => /^0x[a-f0-9]{40}$/.test(item)),
                ),
            ).sort(),
        [reviewerSafes],
    );
    const reviewerSafesKey = normalizedReviewerSafes.join(",");

    const assignedCountBySafe = useMemo(() => {
        const map = new Map<string, number>();
        for (const safe of reviewersByCampaignId.values()) {
            const key = safe.toLowerCase().trim();
            map.set(key, (map.get(key) || 0) + 1);
        }
        return map;
    }, [reviewersByCampaignId]);

    const normalizedWallet = (address || "").toLowerCase();
    const adminWallets = (process.env.NEXT_PUBLIC_ADMIN_WALLETS || "")
        .split(",")
        .map((item) => item.trim().toLowerCase())
        .filter((item) => /^0x[a-f0-9]{40}$/.test(item));
    const isAdminByOwner = Boolean(normalizedWallet) && normalizedWallet === owner;
    const isAdminByRole = (user?.role || "").toLowerCase() === "admin";
    const isAdminByConfig = Boolean(normalizedWallet) && adminWallets.includes(normalizedWallet);
    const isAdmin = Boolean(token && (isAdminByOwner || isAdminByRole || isAdminByConfig));

    useEffect(() => {
        let cancelled = false;
        const loadSafeMeta = async () => {
            const entries = await Promise.all(
                normalizedReviewerSafes.map(async (normalized) => {
                    try {
                        const res = await fetch(
                            `https://safe-transaction-sepolia.safe.global/api/v1/safes/${normalized}/`,
                            { cache: "no-store" },
                        );
                        if (!res.ok) {
                            return [normalized, { threshold: null, ownerCount: null }] as const;
                        }
                        const payload = (await res.json()) as {
                            threshold?: number;
                            owners?: string[];
                        };
                        return [
                            normalized,
                            {
                                threshold:
                                    typeof payload.threshold === "number"
                                        ? payload.threshold
                                        : null,
                                ownerCount: Array.isArray(payload.owners)
                                    ? payload.owners.length
                                    : null,
                            },
                        ] as const;
                    } catch {
                        return [normalized, { threshold: null, ownerCount: null }] as const;
                    }
                }),
            );
            if (cancelled) return;
            setSafeMetaByAddress(Object.fromEntries(entries));
        };
        if (!reviewerSafesKey) return;
        loadSafeMeta();
        return () => {
            cancelled = true;
        };
    }, [normalizedReviewerSafes, reviewerSafesKey]);

    useEffect(() => {
        if (isConfirming || !txHash) return;
        refetch();
    }, [isConfirming, refetch, txHash]);

    if (!isAdmin) {
        return (
            <div className="min-h-screen bg-slate-50 px-6 py-10">
                <main className="mx-auto max-w-3xl rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
                    Tài khoản hiện tại không có quyền truy cập trang quản lý reviewer.
                </main>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 px-6 py-10">
            <main className="mx-auto max-w-6xl rounded-2xl border border-slate-200 bg-white p-6">
                <h1 className="text-2xl font-bold text-slate-900">Quản lý Reviewer Safe</h1>
                <div className="mt-4 flex gap-2">
                    <input
                        value={newSafe}
                        onChange={(e) => setNewSafe(e.target.value)}
                        placeholder="0x..."
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                    <button
                        type="button"
                        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
                        onClick={async () => {
                            const hash = await addReviewerSafe(newSafe.toLowerCase() as `0x${string}`);
                            setTxHash(hash as `0x${string}`);
                            setNewSafe("");
                        }}
                    >
                        Thêm reviewer
                    </button>
                </div>
                <div className="mt-4 space-y-3">
                    {reviewerSafes.map((safe) => (
                        <div key={safe} className="rounded-xl border border-slate-200 p-4">
                            <p className="break-all text-sm font-semibold">{safe}</p>
                            <p className="text-xs text-slate-600">
                                Campaign đang đảm nhận: {assignedCountBySafe.get(safe.toLowerCase()) || 0}
                            </p>
                            <p className="text-xs text-slate-500">
                                Tỉnh/thành phụ trách: Chưa cập nhật
                            </p>
                            <p className="text-xs text-slate-500">
                                Ngưỡng ký (threshold):{" "}
                                {safeMetaByAddress[safe]?.threshold ?? "Không xác định"}
                            </p>
                            <p className="text-xs text-slate-500">
                                Số owner Safe:{" "}
                                {safeMetaByAddress[safe]?.ownerCount ?? "Không xác định"}
                            </p>
                            <button
                                type="button"
                                className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700"
                                onClick={async () => {
                                    const hash = await removeReviewerSafe(safe as `0x${string}`);
                                    setTxHash(hash as `0x${string}`);
                                }}
                            >
                                Xóa
                            </button>
                        </div>
                    ))}
                </div>
            </main>
        </div>
    );
}
