"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useChainId } from "wagmi";
import { getAddress } from "viem";
import {
    clearAdminReviewerProfile,
    getAdminReviewerProfiles,
    patchAdminReviewerProfile,
    useAuth,
    type ReviewerProfileAdminRecord,
} from "@/lib";
import {
    getWalletErrorMessage,
    isWalletUserRejectedMessage,
} from "@/lib/errors/normalize";
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
import { showErrorToast, showSuccessToast } from "@/lib/ui/toast";

const SEPOLIA_CHAIN_ID = 11155111;
const SAFE_META_RETRY_AFTER_429_MS = 60_000;

type SafeMetaEntry = {
    threshold: number | null;
    ownerCount: number | null;
    owners: string[];
};

function formatAdminDate(iso: string | null | undefined) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

export default function AdminReviewersPage() {
    const { token } = useAuth();
    const chainId = useChainId();
    const { isAdminOnChain, isLoading: isCheckingAdminPermission } =
        useReadContractOwner();
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
        Record<string, SafeMetaEntry>
    >({});
    const [safeMetaErrorByAddress, setSafeMetaErrorByAddress] = useState<
        Record<string, string>
    >({});
    const safeMetaCacheRef = useRef<Record<string, SafeMetaEntry>>({});
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

    const [reviewerDbProfiles, setReviewerDbProfiles] = useState<
        ReviewerProfileAdminRecord[]
    >([]);
    const [reviewerDbLoading, setReviewerDbLoading] = useState(false);
    const [reviewerDbError, setReviewerDbError] = useState<string | null>(null);
    const [profileEditor, setProfileEditor] = useState<{
        walletAddress: string;
        organizationName: string;
        region: string;
        isActive: boolean;
    } | null>(null);
    const [profileSaveError, setProfileSaveError] = useState<string | null>(
        null,
    );
    const [profileSaving, setProfileSaving] = useState(false);
    const [clearingWallet, setClearingWallet] = useState<string | null>(null);

    const profileByWallet = useMemo(() => {
        const m = new Map<string, ReviewerProfileAdminRecord>();
        for (const row of reviewerDbProfiles) {
            m.set(row.walletAddress.toLowerCase().trim(), row);
        }
        return m;
    }, [reviewerDbProfiles]);

    async function runClearReviewerProfile(walletAddress: string) {
        if (!token) return;
        const w = walletAddress.toLowerCase().trim();
        const confirmed = window.confirm(
            "Xóa nội dung hồ sơ (tổ chức, tỉnh/thành) của ví này? Địa chỉ ví và mã reviewer vẫn được giữ.",
        );
        if (!confirmed) return;
        setClearingWallet(w);
        try {
            await clearAdminReviewerProfile(token, walletAddress);
            const rows = await getAdminReviewerProfiles(token);
            setReviewerDbProfiles(rows);
            setProfileEditor((cur) =>
                cur?.walletAddress.toLowerCase() === w ? null : cur,
            );
            showSuccessToast("Đã xóa nội dung hồ sơ.");
        } catch (err) {
            showErrorToast(
                err instanceof Error ? err.message : "Không xóa được hồ sơ.",
            );
        } finally {
            setClearingWallet(null);
        }
    }

    const isAdmin = Boolean(token && isAdminOnChain);
    const shouldShowOwnerMismatchWarning = false;

    useEffect(() => {
        setIsMounted(true);
    }, []);

    useEffect(() => {
        if (!isAdmin || !token) {
            setReviewerDbProfiles([]);
            return;
        }
        let cancelled = false;
        setReviewerDbLoading(true);
        setReviewerDbError(null);
        getAdminReviewerProfiles(token)
            .then((rows) => {
                if (!cancelled) setReviewerDbProfiles(rows);
            })
            .catch((err) => {
                if (!cancelled)
                    setReviewerDbError(
                        err instanceof Error
                            ? err.message
                            : "Không tải được hồ sơ reviewer.",
                    );
            })
            .finally(() => {
                if (!cancelled) setReviewerDbLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [isAdmin, token]);

    useEffect(() => {
        if (!reviewerDbError) return;
        showErrorToast(reviewerDbError);
    }, [reviewerDbError]);

    useEffect(() => {
        if (!profileSaveError) return;
        showErrorToast(profileSaveError);
    }, [profileSaveError]);

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
            const entries: Array<readonly [string, SafeMetaEntry]> = [];
            const errorEntries: Array<readonly [string, string]> = [];
            const emptyMeta: SafeMetaEntry = {
                threshold: null,
                ownerCount: null,
                owners: [],
            };
            for (const normalized of pending) {
                let checksumSafe = "";
                try {
                    checksumSafe = getAddress(normalized);
                } catch {
                    entries.push([normalized, { ...emptyMeta }]);
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
                        entries.push([normalized, { ...emptyMeta }]);
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
                    const owners = Array.isArray(payload.owners)
                        ? payload.owners.map((a) =>
                              String(a).toLowerCase().trim(),
                          )
                        : [];
                    entries.push([
                        normalized,
                        {
                            threshold:
                                typeof payload.threshold === "number"
                                    ? payload.threshold
                                    : null,
                            ownerCount: owners.length,
                            owners,
                        },
                    ]);
                    errorEntries.push([normalized, ""]);
                } catch {
                    entries.push([normalized, { ...emptyMeta }]);
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
            } catch {
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
            if (token) {
                getAdminReviewerProfiles(token)
                    .then(setReviewerDbProfiles)
                    .catch(() => {});
            }
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
            const normalized = getWalletErrorMessage(txError, {
                fallback: "Giao dịch thất bại hoặc bị từ chối.",
            });
            const isCancelledByUser =
                isWalletUserRejectedMessage(normalized);
            showErrorToast(normalized, {
                emphasis: !isCancelledByUser,
            });
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
        token,
    ]);

    const isAccessChecking = !isMounted || isCheckingAdminPermission;

    if (isAccessChecking) {
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
                                const normalized = getWalletErrorMessage(error, {
                                    fallback: "Không thể thêm reviewer safe.",
                                });
                                const isCancelledByUser =
                                    isWalletUserRejectedMessage(normalized);
                                showErrorToast(normalized, {
                                    emphasis: !isCancelledByUser,
                                });
                            }
                        }}
                    >
                        Thêm reviewer
                    </button>
                </div>

                <div className="mt-8 rounded-xl border border-indigo-100 bg-indigo-50/40 p-4">
                    <h2 className="text-sm font-bold text-indigo-900">
                        Hồ sơ reviewer (đã lưu trên hệ thống)
                    </h2>
                    <p className="mt-1 text-xs text-indigo-800/90">
                        Reviewer dùng ví Safe thường không tự cập nhật qua trang Settings — admin có thể thêm/sửa
                        tổ chức, tỉnh/thành và trạng thái hoạt động tại đây. Ghép với từng Safe qua địa chỉ owner
                        (EOA).
                    </p>
                    {reviewerDbLoading && (
                        <p className="mt-2 text-sm text-slate-600">Đang tải...</p>
                    )}
                    {reviewerDbError && (
                        <p className="mt-2 text-sm text-slate-500">
                            Không thể tải hồ sơ reviewer.
                        </p>
                    )}
                    {!reviewerDbLoading &&
                        !reviewerDbError &&
                        reviewerDbProfiles.length === 0 && (
                            <p className="mt-2 text-sm text-slate-600">
                                Chưa có reviewer nào gửi hồ sơ.
                            </p>
                        )}
                    {!reviewerDbLoading && reviewerDbProfiles.length > 0 && (
                        <div className="mt-3 overflow-x-auto rounded-lg border border-indigo-100 bg-white">
                            <table className="min-w-full text-left text-sm">
                                <thead>
                                    <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-600">
                                        <th className="px-3 py-2">Ví (EOA)</th>
                                        <th className="px-3 py-2">Mã reviewer</th>
                                        <th className="px-3 py-2">Tổ chức</th>
                                        <th className="px-3 py-2">Tỉnh / thành</th>
                                        <th className="px-3 py-2">Hoạt động</th>
                                        <th className="px-3 py-2">Cập nhật</th>
                                        <th className="px-3 py-2">Thao tác</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {reviewerDbProfiles.map((row) => (
                                        <tr
                                            key={row.walletAddress}
                                            className="border-b border-slate-100 last:border-0"
                                        >
                                            <td className="max-w-[220px] px-3 py-2 font-mono text-[11px] text-slate-800 break-all">
                                                {row.walletAddress}
                                            </td>
                                            <td className="px-3 py-2 text-xs">
                                                {row.reviewerCode || "—"}
                                            </td>
                                            <td className="px-3 py-2">
                                                {row.organizationName || "—"}
                                            </td>
                                            <td className="px-3 py-2">
                                                {row.region || "—"}
                                            </td>
                                            <td className="px-3 py-2 text-xs">
                                                {row.isActive !== false
                                                    ? "Có"
                                                    : "Tắt"}
                                            </td>
                                            <td className="px-3 py-2 text-xs text-slate-500">
                                                {formatAdminDate(row.updatedAt)}
                                            </td>
                                            <td className="px-3 py-2">
                                                <div className="flex flex-wrap gap-1.5">
                                                    <button
                                                        type="button"
                                                        className="rounded-md border border-indigo-200 bg-white px-2 py-1 text-xs font-semibold text-indigo-800 hover:bg-indigo-50 disabled:opacity-50"
                                                        disabled={
                                                            clearingWallet ===
                                                            row.walletAddress.toLowerCase()
                                                        }
                                                        onClick={() => {
                                                            setProfileSaveError(
                                                                null,
                                                            );
                                                            setProfileEditor({
                                                                walletAddress:
                                                                    row.walletAddress,
                                                                organizationName:
                                                                    row.organizationName ||
                                                                    "",
                                                                region:
                                                                    row.region ||
                                                                    "",
                                                                isActive:
                                                                    row.isActive !==
                                                                    false,
                                                            });
                                                        }}
                                                    >
                                                        Sửa
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs font-semibold text-red-800 hover:bg-red-100 disabled:opacity-50"
                                                        disabled={
                                                            clearingWallet ===
                                                            row.walletAddress.toLowerCase()
                                                        }
                                                        onClick={() =>
                                                            runClearReviewerProfile(
                                                                row.walletAddress,
                                                            )
                                                        }
                                                    >
                                                        {clearingWallet ===
                                                        row.walletAddress.toLowerCase()
                                                            ? "Đang xóa…"
                                                            : "Xóa"}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                <div className="mt-6 space-y-3">
                    <h2 className="text-sm font-semibold text-slate-800">
                        Reviewer Safe trên contract
                    </h2>
                    {reviewerSafes.map((safe) => {
                        const safeKey = safe.toLowerCase();
                        const meta = safeMetaByAddress[safeKey];
                        const safeProfile = profileByWallet.get(safeKey);
                        const owners = meta?.owners ?? [];
                        return (
                        <div
                            key={safe}
                            className="rounded-xl border border-slate-200 p-4"
                        >
                            <p className="break-all text-sm font-semibold">
                                {safe}
                            </p>
                            <p className="text-xs text-slate-600">
                                Campaign đang đảm nhận:{" "}
                                {assignedCountBySafe.get(safeKey) || 0}
                            </p>
                            <p className="mt-2 text-xs font-medium text-slate-700">
                                Safe (threshold / owners):{" "}
                                {meta?.threshold ?? "—"} /{" "}
                                {meta?.ownerCount ?? "—"}
                            </p>
                            <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50 p-3">
                                <p className="text-xs font-semibold text-slate-700">
                                    Hồ sơ theo địa chỉ Safe
                                </p>
                                {safeProfile ? (
                                    <div className="mt-2 rounded-md border border-white bg-white px-2 py-2 text-xs shadow-sm">
                                        <p className="font-mono text-[11px] text-slate-800 break-all">
                                            {safe}
                                        </p>
                                        <div className="mt-1.5 space-y-0.5 text-slate-700">
                                            <p>
                                                <span className="text-slate-500">
                                                    Mã:
                                                </span>{" "}
                                                {safeProfile.reviewerCode || "—"}
                                            </p>
                                            <p>
                                                <span className="text-slate-500">
                                                    Tổ chức:
                                                </span>{" "}
                                                {safeProfile.organizationName ||
                                                    "—"}
                                            </p>
                                            <p>
                                                <span className="text-slate-500">
                                                    Tỉnh/TP:
                                                </span>{" "}
                                                {safeProfile.region || "—"}
                                            </p>
                                            <p className="text-[11px] text-slate-400">
                                                Cập nhật hồ sơ:{" "}
                                                {formatAdminDate(
                                                    safeProfile.updatedAt,
                                                )}
                                            </p>
                                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                                                <button
                                                    type="button"
                                                    className="rounded-md border border-indigo-200 bg-indigo-50/80 px-2 py-1 text-[11px] font-semibold text-indigo-900 hover:bg-indigo-100 disabled:opacity-50"
                                                    disabled={
                                                        clearingWallet ===
                                                        safeKey
                                                    }
                                                    onClick={() => {
                                                        setProfileSaveError(
                                                            null,
                                                        );
                                                        setProfileEditor({
                                                            walletAddress: safe,
                                                            organizationName:
                                                                safeProfile.organizationName ||
                                                                "",
                                                            region:
                                                                safeProfile.region ||
                                                                "",
                                                            isActive:
                                                                safeProfile.isActive !==
                                                                false,
                                                        });
                                                    }}
                                                >
                                                    Sửa hồ sơ Safe
                                                </button>
                                                <button
                                                    type="button"
                                                    className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-800 hover:bg-red-100 disabled:opacity-50"
                                                    disabled={
                                                        clearingWallet ===
                                                        safeKey
                                                    }
                                                    onClick={() =>
                                                        runClearReviewerProfile(
                                                            safe,
                                                        )
                                                    }
                                                >
                                                    {clearingWallet === safeKey
                                                        ? "Đang xóa…"
                                                        : "Xóa hồ sơ"}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="mt-2 space-y-1.5">
                                        <p className="text-amber-800">
                                            Chưa có hồ sơ cho địa chỉ Safe này.
                                            Admin có thể thêm thủ công.
                                        </p>
                                        <button
                                            type="button"
                                            className="rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-900 hover:bg-amber-100"
                                            onClick={() => {
                                                setProfileSaveError(null);
                                                setProfileEditor({
                                                    walletAddress: safe,
                                                    organizationName: "",
                                                    region: "",
                                                    isActive: true,
                                                });
                                            }}
                                        >
                                            Thêm hồ sơ Safe (admin)
                                        </button>
                                    </div>
                                )}
                            </div>
                            <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50 p-3">
                                <p className="text-xs font-semibold text-slate-700">
                                    Owner Safe &amp; hồ sơ đăng ký
                                </p>
                                <ul className="mt-2 space-y-2">
                                    {owners.length === 0 ? (
                                        <li className="text-xs text-slate-500">
                                            {safeMetaErrorByAddress[safeKey]
                                                ? "Không tải được danh sách owner."
                                                : "Chưa có metadata Safe (đang tải hoặc chưa có owner)."}
                                        </li>
                                    ) : (
                                        owners.map((owner) => {
                                            const p = profileByWallet.get(owner);
                                            return (
                                                <li
                                                    key={`${safe}-${owner}`}
                                                    className="rounded-md border border-white bg-white px-2 py-2 text-xs shadow-sm"
                                                >
                                                    <p className="font-mono text-[11px] text-slate-800 break-all">
                                                        {owner}
                                                    </p>
                                                    {p ? (
                                                        <div className="mt-1.5 space-y-0.5 text-slate-700">
                                                            <p>
                                                                <span className="text-slate-500">
                                                                    Mã:
                                                                </span>{" "}
                                                                {p.reviewerCode ||
                                                                    "—"}
                                                            </p>
                                                            <p>
                                                                <span className="text-slate-500">
                                                                    Tổ chức:
                                                                </span>{" "}
                                                                {p.organizationName ||
                                                                    "—"}
                                                            </p>
                                                            <p>
                                                                <span className="text-slate-500">
                                                                    Tỉnh/TP:
                                                                </span>{" "}
                                                                {p.region || "—"}
                                                            </p>
                                                            <p className="text-[11px] text-slate-400">
                                                                Cập nhật hồ sơ:{" "}
                                                                {formatAdminDate(
                                                                    p.updatedAt,
                                                                )}
                                                            </p>
                                                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                                                                <button
                                                                    type="button"
                                                                    className="rounded-md border border-indigo-200 bg-indigo-50/80 px-2 py-1 text-[11px] font-semibold text-indigo-900 hover:bg-indigo-100 disabled:opacity-50"
                                                                    disabled={
                                                                        clearingWallet ===
                                                                        owner.toLowerCase()
                                                                    }
                                                                    onClick={() => {
                                                                        setProfileSaveError(
                                                                            null,
                                                                        );
                                                                        setProfileEditor(
                                                                            {
                                                                                walletAddress:
                                                                                    owner,
                                                                                organizationName:
                                                                                    p.organizationName ||
                                                                                    "",
                                                                                region:
                                                                                    p.region ||
                                                                                    "",
                                                                                isActive:
                                                                                    p.isActive !==
                                                                                    false,
                                                                            },
                                                                        );
                                                                    }}
                                                                >
                                                                    Sửa hồ sơ
                                                                    (admin)
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-800 hover:bg-red-100 disabled:opacity-50"
                                                                    disabled={
                                                                        clearingWallet ===
                                                                        owner.toLowerCase()
                                                                    }
                                                                    onClick={() =>
                                                                        runClearReviewerProfile(
                                                                            owner,
                                                                        )
                                                                    }
                                                                >
                                                                    {clearingWallet ===
                                                                    owner.toLowerCase()
                                                                        ? "Đang xóa…"
                                                                        : "Xóa hồ sơ"}
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="mt-1 space-y-1.5">
                                                            <p className="text-amber-800">
                                                                Chưa có hồ sơ — ví
                                                                Safe không tự
                                                                điền; admin có
                                                                thể thêm.
                                                            </p>
                                                            <button
                                                                type="button"
                                                                className="rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-900 hover:bg-amber-100"
                                                                onClick={() => {
                                                                    setProfileSaveError(
                                                                        null,
                                                                    );
                                                                    setProfileEditor(
                                                                        {
                                                                            walletAddress:
                                                                                owner,
                                                                            organizationName:
                                                                                "",
                                                                            region:
                                                                                "",
                                                                            isActive:
                                                                                true,
                                                                        },
                                                                    );
                                                                }}
                                                            >
                                                                Thêm hồ sơ (admin)
                                                            </button>
                                                        </div>
                                                    )}
                                                </li>
                                            );
                                        })
                                    )}
                                </ul>
                            </div>
                            {safeMetaErrorByAddress[safeKey] && (
                                <p className="mt-1 text-xs text-red-600">
                                    {safeMetaErrorByAddress[safeKey]}
                                </p>
                            )}
                            <button
                                type="button"
                                disabled={!isAdminOnChain}
                                className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                                onClick={async () => {
                                    try {
                                        const hash = await removeReviewerSafe(
                                            safe as `0x${string}`,
                                        );
                                        setTxHash(hash as `0x${string}`);
                                        setPendingAction({
                                            type: "remove",
                                            safe,
                                        });
                                    } catch (error) {
                                        const normalized = getWalletErrorMessage(
                                            error,
                                            {
                                                fallback:
                                                    "Không thể xóa reviewer safe.",
                                            },
                                        );
                                        const isCancelledByUser =
                                            isWalletUserRejectedMessage(
                                                normalized,
                                            );
                                        showErrorToast(normalized, {
                                            emphasis: !isCancelledByUser,
                                        });
                                    }
                                }}
                            >
                                Xóa
                            </button>
                        </div>
                        );
                    })}
                </div>
            </main>

            {profileEditor && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
                    role="presentation"
                    onClick={(e) => {
                        if (e.target === e.currentTarget && !profileSaving) {
                            setProfileEditor(null);
                            setProfileSaveError(null);
                        }
                    }}
                >
                    <div
                        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl"
                        role="dialog"
                        aria-labelledby="profile-editor-title"
                    >
                        <h2
                            id="profile-editor-title"
                            className="text-lg font-bold text-slate-900"
                        >
                            Hồ sơ reviewer (admin)
                        </h2>
                        <p className="mt-1 break-all font-mono text-[11px] text-slate-600">
                            {profileEditor.walletAddress}
                        </p>
                        <label className="mt-4 block text-xs font-semibold text-slate-700">
                            Tổ chức
                            <input
                                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                                value={profileEditor.organizationName}
                                onChange={(e) =>
                                    setProfileEditor((prev) =>
                                        prev
                                            ? {
                                                  ...prev,
                                                  organizationName:
                                                      e.target.value,
                                              }
                                            : prev,
                                    )
                                }
                                disabled={profileSaving}
                            />
                        </label>
                        <label className="mt-3 block text-xs font-semibold text-slate-700">
                            Tỉnh / thành
                            <input
                                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                                value={profileEditor.region}
                                onChange={(e) =>
                                    setProfileEditor((prev) =>
                                        prev
                                            ? {
                                                  ...prev,
                                                  region: e.target.value,
                                              }
                                            : prev,
                                    )
                                }
                                disabled={profileSaving}
                            />
                        </label>
                        <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-slate-800">
                            <input
                                type="checkbox"
                                checked={profileEditor.isActive}
                                onChange={(e) =>
                                    setProfileEditor((prev) =>
                                        prev
                                            ? {
                                                  ...prev,
                                                  isActive: e.target.checked,
                                              }
                                            : prev,
                                    )
                                }
                                disabled={profileSaving}
                            />
                            Đang hoạt động
                        </label>
                        <div className="mt-5 flex justify-end gap-2">
                            <button
                                type="button"
                                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
                                disabled={profileSaving}
                                onClick={() => {
                                    if (!profileSaving) {
                                        setProfileEditor(null);
                                        setProfileSaveError(null);
                                    }
                                }}
                            >
                                Hủy
                            </button>
                            <button
                                type="button"
                                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                                disabled={profileSaving || !token}
                                onClick={async () => {
                                    if (!token || !profileEditor) return;
                                    setProfileSaving(true);
                                    setProfileSaveError(null);
                                    try {
                                        await patchAdminReviewerProfile(
                                            token,
                                            profileEditor.walletAddress,
                                            {
                                                organizationName:
                                                    profileEditor.organizationName,
                                                region: profileEditor.region,
                                                isActive:
                                                    profileEditor.isActive,
                                            },
                                        );
                                        const rows =
                                            await getAdminReviewerProfiles(
                                                token,
                                            );
                                        setReviewerDbProfiles(rows);
                                        showSuccessToast(
                                            "Đã cập nhật hồ sơ reviewer.",
                                        );
                                        setProfileEditor(null);
                                    } catch (err) {
                                        setProfileSaveError(
                                            err instanceof Error
                                                ? err.message
                                                : "Không lưu được hồ sơ.",
                                        );
                                    } finally {
                                        setProfileSaving(false);
                                    }
                                }}
                            >
                                {profileSaving ? "Đang lưu…" : "Lưu"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
