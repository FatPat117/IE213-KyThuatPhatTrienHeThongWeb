"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAccount, useChainId } from "wagmi";
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
import { showSuccessToast } from "@/lib/ui/toast";

const SEPOLIA_CHAIN_ID = 11155111;
const SAFE_META_RETRY_AFTER_429_MS = 60_000;

export default function AdminReviewersPage() {
    const { token, user } = useAuth();
    const { address } = useAccount();
    const chainId = useChainId();
    const { isAdminOnChain } = useReadContractOwner();
    const isSepolia = chainId === SEPOLIA_CHAIN_ID;
    const [newSafe, setNewSafe] = useState("");
    const [newSafeValidation, setNewSafeValidation] = useState<{
        status: "idle" | "validating" | "valid" | "invalid";
        threshold?: number;
        ownerCount?: number;
        owners?: string[];
        error?: string;
    }>({ status: "idle" });
    const [txHash, setTxHash] = useState<`0x${string}` | undefined>(undefined);
    const [pendingAction, setPendingAction] = useState<{
        type: "add" | "remove";
        safe: string;
    } | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);
    const [isMounted, setIsMounted] = useState(false);
    const { reviewerSafes, refetch } = useReadReviewerSafesOnChain();
    const { campaigns } = useReadAllCampaigns();
    const { reviewersByCampaignId } = useReadCampaignReviewersBatch(
        campaigns.length,
    );
    const { addReviewerSafe } = useAddReviewerSafe();
    const { removeReviewerSafe } = useRemoveReviewerSafe();
    const {
        isLoading: isConfirming,
        isSuccess: isTxSuccess,
        isError: isTxError,
        error: txError,
    } = useWaitForTransactionReceipt({
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
    const isAdmin = Boolean(token && isAdminOnChain);
    const shouldShowOwnerMismatchWarning = false;

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

    // Debounced validation for new Safe input
    useEffect(() => {
        const timer = setTimeout(async () => {
            const input = newSafe.trim().toLowerCase();
            if (!/^0x[a-f0-9]{40}$/.test(input)) {
                setNewSafeValidation({ status: "idle" });
                return;
            }

            setNewSafeValidation({ status: "validating" });

            try {
                const checksumSafe = getAddress(input);
                const res = await fetch(
                    `https://safe-transaction-sepolia.safe.global/api/v1/safes/${checksumSafe}/`,
                    { cache: "no-store" },
                );

                if (!res.ok) {
                    if (res.status === 404) {
                        setNewSafeValidation({
                            status: "invalid",
                            error: "Địa chỉ này không phải Gnosis Safe hợp lệ trên Sepolia",
                        });
                    } else {
                        setNewSafeValidation({
                            status: "invalid",
                            error: `Safe API error (${res.status})`,
                        });
                    }
                    return;
                }

                const payload = (await res.json()) as {
                    threshold?: number;
                    owners?: string[];
                };

                if (!payload.threshold || !Array.isArray(payload.owners)) {
                    setNewSafeValidation({
                        status: "invalid",
                        error: "Safe metadata không hợp lệ",
                    });
                    return;
                }

                setNewSafeValidation({
                    status: "valid",
                    threshold: payload.threshold,
                    ownerCount: payload.owners.length,
                    owners: payload.owners,
                });
            } catch (error) {
                setNewSafeValidation({
                    status: "invalid",
                    error: "Không thể kết nối đến Safe API",
                });
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [newSafe]);

    useEffect(() => {
        if (!txHash || !pendingAction) return;
        if (isConfirming) return;

        if (isTxSuccess) {
            refetch();
            if (pendingAction.type === "add") {
                showSuccessToast(
                    `Thêm reviewer thành công: ${pendingAction.safe.slice(0, 8)}...${pendingAction.safe.slice(-4)}`,
                );
            } else {
                showSuccessToast(
                    `Xóa reviewer thành công: ${pendingAction.safe.slice(0, 8)}...${pendingAction.safe.slice(-4)}`,
                );
            }
            setPendingAction(null);
            setTxHash(undefined);
            return;
        }

        if (isTxError) {
            setActionError(
                txError instanceof Error
                    ? txError.message
                    : "Giao dịch thất bại hoặc bị từ chối.",
            );
            setPendingAction(null);
            setTxHash(undefined);
        }
    }, [
        isConfirming,
        isTxError,
        isTxSuccess,
        pendingAction,
        refetch,
        txError,
        txHash,
    ]);

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
                {shouldShowOwnerMismatchWarning && (
                    <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                        Ví hiện tại có thể vào trang admin nhưng không có quyền
                        ADMIN_ROLE on-chain, nên không thể thêm/xóa reviewer Safe.
                    </p>
                )}
                {!isSepolia && (
                    <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                        ⚠️ Bạn đang kết nối đến network không phải Sepolia. Reviewer Safe chỉ được đồng bộ trên Sepolia. Vui lòng chuyển sang Sepolia trước khi thêm/xóa reviewer.
                    </p>
                )}
                {actionError && (
                    <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                        {actionError}
                    </p>
                )}
                <div className="mt-4 flex gap-2">
                    <div className="flex-1">
                        <input
                            value={newSafe}
                            onChange={(e) => setNewSafe(e.target.value)}
                            placeholder="0x..."
                            className={`w-full rounded-lg border px-3 py-2 text-sm ${
                                newSafeValidation.status === "invalid"
                                    ? "border-red-300 bg-red-50 focus:border-red-400 focus:ring-1 focus:ring-red-200"
                                    : newSafeValidation.status === "valid"
                                    ? "border-emerald-300 bg-emerald-50 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200"
                                    : "border-slate-300 focus:border-blue-400 focus:ring-1 focus:ring-blue-200"
                            }`}
                        />
                        {newSafeValidation.status === "validating" && (
                            <p className="mt-1 text-xs text-blue-600">
                                Đang kiểm tra Safe...
                            </p>
                        )}
                        {newSafeValidation.status === "valid" && (
                            <div className="mt-2 space-y-1 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                                <p className="text-xs font-semibold text-emerald-800">
                                    ✅ Địa chỉ Safe hợp lệ
                                </p>
                                <p className="text-xs text-emerald-700">
                                    Threshold: {newSafeValidation.threshold} / {newSafeValidation.ownerCount} owners
                                </p>
                                <p className="text-xs text-emerald-600">
                                    Có thể thêm vào danh sách reviewer
                                </p>
                            </div>
                        )}
                        {newSafeValidation.status === "invalid" && (
                            <p className="mt-1 text-xs text-red-600">
                                {newSafeValidation.error}
                            </p>
                        )}
                    </div>
                    <button
                        type="button"
                        disabled={
                            !isAdminOnChain ||
                            !isSepolia ||
                            newSafeValidation.status !== "valid" ||
                            !/^0x[a-f0-9]{40}$/.test(newSafe.trim().toLowerCase())
                        }
                        title={
                            !isSepolia
                                ? "Cần chuyển sang Sepolia để thêm reviewer"
                                : undefined
                        }
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
                                setPendingAction({
                                    type: "add",
                                    safe: normalized,
                                });
                                setNewSafe("");
                                setNewSafeValidation({ status: "idle" });
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
                                disabled={!isAdminOnChain}
                                className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                                onClick={async () => {
                                    try {
                                        setActionError(null);
                                        const hash = await removeReviewerSafe(
                                            safe as `0x${string}`,
                                        );
                                        setTxHash(hash as `0x${string}`);
                                        setPendingAction({
                                            type: "remove",
                                            safe,
                                        });
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
