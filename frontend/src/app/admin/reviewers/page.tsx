"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAccount } from "wagmi";
import { getAddress } from "viem";
import { useAuth } from "@/lib";
import {
    useAddReviewerSafe,
    useReadAllCampaigns,
    useReadCampaignReviewersBatch,
    useReadContractOwner,
    useReadReviewerSafesOnChain,
    useRemoveReviewerSafe,
} from "@/lib/contracts/hooks";
import { useWaitForTransactionReceipt } from "wagmi";
import { useRegisterWalletTxOverlay } from "@/context/wallet-tx-overlay";

const SAFE_META_RETRY_AFTER_429_MS = 60_000;

export default function AdminReviewersPage() {
    const { token, user } = useAuth();
    const { address } = useAccount();
    const { owner } = useReadContractOwner();
    const [newSafe, setNewSafe] = useState("");
    const [txHash, setTxHash] = useState<`0x${string}` | undefined>(undefined);
    const [actionError, setActionError] = useState<string | null>(null);
    const [isMounted, setIsMounted] = useState(false);
    const { reviewerSafes, refetch } = useReadReviewerSafesOnChain();
    const { campaigns } = useReadAllCampaigns();
    const { reviewersByCampaignId } = useReadCampaignReviewersBatch(
        campaigns.length,
    );
    const { addReviewerSafe } = useAddReviewerSafe();
    const { removeReviewerSafe } = useRemoveReviewerSafe();
    const { isLoading: isConfirming } = useWaitForTransactionReceipt({
        hash: txHash,
    });
    useRegisterWalletTxOverlay(isConfirming);
    const [safeMetaByAddress, setSafeMetaByAddress] = useState<
        Record<string, { threshold: number | null; ownerCount: number | null }>
    >({});
    const [safeMetaErrorByAddress, setSafeMetaErrorByAddress] = useState<
        Record<string, string>
    >({});
    const safeMetaCacheRef = useRef<
        Record<string, { threshold: number | null; ownerCount: number | null }>
    >({});
    const safeMetaRetryAfterRef = useRef<Record<string, number>>({});
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
    const isAdminByOwner =
        Boolean(normalizedWallet) && normalizedWallet === owner;
    const isAdminByRole = (user?.role || "").toLowerCase() === "admin";
    const isAdminByConfig =
        Boolean(normalizedWallet) && adminWallets.includes(normalizedWallet);
    const isAdmin = Boolean(
        token && (isAdminByOwner || isAdminByRole || isAdminByConfig),
    );
    const isContractOwner =
        Boolean(normalizedWallet) && normalizedWallet === owner;

    useEffect(() => {
        setIsMounted(true);
    }, []);

    useEffect(() => {
        let cancelled = false;
        const loadSafeMeta = async () => {
            const now = Date.now();
            const pending = normalizedReviewerSafes.filter(
                (safe) =>
                    safeMetaCacheRef.current[safe] === undefined &&
                    (safeMetaRetryAfterRef.current[safe] ?? 0) <= now,
            );
            if (pending.length === 0) return;
            const entries: Array<
                readonly [
                    string,
                    { threshold: number | null; ownerCount: number | null },
                ]
            > = [];
            const errorEntries: Array<readonly [string, string]> = [];
            for (const normalized of pending) {
                let checksumSafe = "";
                try {
                    checksumSafe = getAddress(normalized);
                } catch {
                    entries.push([
                        normalized,
                        { threshold: null, ownerCount: null },
                    ]);
                    errorEntries.push([
                        normalized,
                        "Invalid Safe address checksum.",
                    ]);
                    continue;
                }
                try {
                    const res = await fetch(
                        `https://safe-transaction-sepolia.safe.global/api/v1/safes/${checksumSafe}/`,
                        { cache: "no-store" },
                    );
                    if (res.status === 429) {
                        safeMetaRetryAfterRef.current[normalized] =
                            Date.now() + SAFE_META_RETRY_AFTER_429_MS;
                        continue;
                    }
                    if (!res.ok) {
                        entries.push([
                            normalized,
                            { threshold: null, ownerCount: null },
                        ]);
                        errorEntries.push([
                            normalized,
                            `Safe API error (${res.status}).`,
                        ]);
                        continue;
                    }
                    const payload = (await res.json()) as {
                        threshold?: number;
                        owners?: string[];
                    };
                    entries.push([
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
                    ]);
                    errorEntries.push([normalized, ""]);
                } catch {
                    entries.push([
                        normalized,
                        { threshold: null, ownerCount: null },
                    ]);
                    errorEntries.push([
                        normalized,
                        "Unable to load Safe metadata.",
                    ]);
                }
            }
            if (cancelled) return;
            if (entries.length === 0) return;
            const nextCache = {
                ...safeMetaCacheRef.current,
                ...Object.fromEntries(entries),
            };
            safeMetaCacheRef.current = nextCache;
            setSafeMetaByAddress(nextCache);
            if (errorEntries.length > 0) {
                setSafeMetaErrorByAddress((prev) => ({
                    ...prev,
                    ...Object.fromEntries(errorEntries),
                }));
            }
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

    if (!isMounted) {
        return (
            <div className="min-h-screen bg-slate-50 px-6 py-10">
                <main className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
                    Đang tải quyền truy cập...
                </main>
            </div>
        );
    }

    if (!isAdmin) {
        return (
            <div className="min-h-screen bg-slate-50 px-6 py-10">
                <main className="mx-auto max-w-3xl rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
                    Tài khoản hiện tại không có quyền truy cập trang quản lý
                    reviewer.
                </main>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 px-6 py-10">
            <main className="mx-auto max-w-6xl rounded-2xl border border-slate-200 bg-white p-6">
                <h1 className="text-2xl font-bold text-slate-900">
                    Quản lý Reviewer Safe
                </h1>
                {!isContractOwner && (
                    <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                        Ví hiện tại có thể vào trang admin nhưng không phải
                        owner on-chain, nên không thể thêm/xóa reviewer Safe.
                    </p>
                )}
                {actionError && (
                    <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                        {actionError}
                    </p>
                )}
                <div className="mt-4 flex gap-2">
                    <input
                        value={newSafe}
                        onChange={(e) => setNewSafe(e.target.value)}
                        placeholder="0x..."
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                    <button
                        type="button"
                        disabled={!isContractOwner}
                        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                        onClick={async () => {
                            try {
                                setActionError(null);
                                const normalized = newSafe.trim().toLowerCase();
                                if (!/^0x[a-f0-9]{40}$/.test(normalized)) {
                                    throw new Error(
                                        "Địa chỉ Safe không hợp lệ.",
                                    );
                                }
                                const hash = await addReviewerSafe(
                                    normalized as `0x${string}`,
                                );
                                setTxHash(hash as `0x${string}`);
                                setNewSafe("");
                            } catch (error) {
                                setActionError(
                                    error instanceof Error
                                        ? error.message
                                        : "Không thể thêm reviewer safe.",
                                );
                            }
                        }}
                    >
                        Thêm reviewer
                    </button>
                </div>
                <div className="mt-4 space-y-3">
                    {reviewerSafes.map((safe) => (
                        <div
                            key={safe}
                            className="rounded-xl border border-slate-200 p-4"
                        >
                            <p className="break-all text-sm font-semibold">
                                {safe}
                            </p>
                            <p className="text-xs text-slate-600">
                                Campaign đang đảm nhận:{" "}
                                {assignedCountBySafe.get(safe.toLowerCase()) ||
                                    0}
                            </p>
                            <p className="text-xs text-slate-500">
                                Tỉnh/thành phụ trách: Chưa cập nhật
                            </p>
                            <p className="text-xs text-slate-500">
                                Ngưỡng ký (threshold):{" "}
                                {safeMetaByAddress[safe]?.threshold ??
                                    "Không xác định"}
                            </p>
                            <p className="text-xs text-slate-500">
                                Số owner Safe:{" "}
                                {safeMetaByAddress[safe]?.ownerCount ??
                                    "Không xác định"}
                            </p>
                            {safeMetaErrorByAddress[safe] && (
                                <p className="mt-1 text-xs text-red-600">
                                    {safeMetaErrorByAddress[safe]}
                                </p>
                            )}
                            <button
                                type="button"
                                disabled={!isContractOwner}
                                className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                                onClick={async () => {
                                    try {
                                        setActionError(null);
                                        const hash = await removeReviewerSafe(
                                            safe as `0x${string}`,
                                        );
                                        setTxHash(hash as `0x${string}`);
                                    } catch (error) {
                                        setActionError(
                                            error instanceof Error
                                                ? error.message
                                                : "Không thể xóa reviewer safe.",
                                        );
                                    }
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
