"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useAccount } from "wagmi";
import Link from "next/link";
import {
    getReviewerProfile,
    getUserProfile,
    toAuthUserProfile,
    updateReviewerProfile,
    updateUserProfile,
    useAuth,
    useIsReviewer,
} from "@/lib";

const MAX_AVATAR_FILE_BYTES = 2 * 1024 * 1024;
const MAX_AVATAR_PAYLOAD_BYTES = 1_200_000;
const MAX_AVATAR_DIMENSION = 512;

async function fileToDataUrl(file: File) {
    return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error("Không thể đọc file ảnh."));
        reader.readAsDataURL(file);
    });
}

function dataUrlPayloadBytes(dataUrl: string) {
    if (!dataUrl) return 0;
    const base64 = dataUrl.includes(",")
        ? dataUrl.split(",")[1] || ""
        : dataUrl;
    const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
    return Math.max((base64.length * 3) / 4 - padding, 0);
}

async function optimizeAvatarDataUrl(file: File) {
    const originalDataUrl = await fileToDataUrl(file);
    if (dataUrlPayloadBytes(originalDataUrl) <= MAX_AVATAR_PAYLOAD_BYTES) {
        return originalDataUrl;
    }

    const bitmap = await createImageBitmap(file);
    const scale = Math.min(
        MAX_AVATAR_DIMENSION / bitmap.width,
        MAX_AVATAR_DIMENSION / bitmap.height,
        1,
    );
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return originalDataUrl;
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const webpDataUrl = canvas.toDataURL("image/webp", 0.8);
    if (dataUrlPayloadBytes(webpDataUrl) <= MAX_AVATAR_PAYLOAD_BYTES) {
        return webpDataUrl;
    }

    const jpegDataUrl = canvas.toDataURL("image/jpeg", 0.75);
    return jpegDataUrl;
}

export default function SettingsPage() {
    const { address, isConnected } = useAccount();
    const { token, user, setAuth } = useAuth();
    const { isReviewer, isLoading: isReviewerRoleLoading } = useIsReviewer();

    /** Tránh hydration mismatch: wagmi `isConnected` / `address` khác SSR và client. */
    const [isMounted, setIsMounted] = useState(false);
    useEffect(() => {
        setIsMounted(true);
    }, []);

    const [displayName, setDisplayName] = useState("");
    const [avatarDataUrl, setAvatarDataUrl] = useState("");
    const [organizationName, setOrganizationName] = useState("");
    const [region, setRegion] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingReviewerProfile, setIsLoadingReviewerProfile] =
        useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [reviewerProfileError, setReviewerProfileError] = useState<
        string | null
    >(null);
    const [success, setSuccess] = useState<string | null>(null);

    const walletAddress = useMemo(
        () => address || user?.wallet || "",
        [address, user?.wallet],
    );
    const canEdit = Boolean(token && walletAddress);

    useEffect(() => {
        if (!walletAddress) {
            setIsLoading(false);
            return;
        }

        let cancelled = false;
        setIsLoading(true);
        setError(null);

        getUserProfile(walletAddress)
            .then((profile) => {
                if (cancelled) return;
                setDisplayName(profile?.displayName || "");
                setAvatarDataUrl(profile?.avatarUrl || "");
            })
            .catch((err) => {
                if (cancelled) return;
                setError(
                    err instanceof Error
                        ? err.message
                        : "Không tải được thông tin người dùng.",
                );
            })
            .finally(() => {
                if (!cancelled) setIsLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [walletAddress]);

    useEffect(() => {
        if (!walletAddress || !token || !isReviewer || isReviewerRoleLoading) {
            if (!isReviewer || !token) {
                setOrganizationName("");
                setRegion("");
            }
            return;
        }

        let cancelled = false;
        setIsLoadingReviewerProfile(true);
        setReviewerProfileError(null);

        getReviewerProfile(token, walletAddress.trim().toLowerCase())
            .then((profile) => {
                if (cancelled) return;
                setOrganizationName(profile.organizationName || "");
                setRegion(profile.region || "");
            })
            .catch((err) => {
                if (cancelled) return;
                setReviewerProfileError(
                    err instanceof Error
                        ? err.message
                        : "Không tải được thông tin reviewer.",
                );
            })
            .finally(() => {
                if (!cancelled) setIsLoadingReviewerProfile(false);
            });

        return () => {
            cancelled = true;
        };
    }, [walletAddress, token, isReviewer, isReviewerRoleLoading]);

    const handleAvatarFileChange = async (
        event: React.ChangeEvent<HTMLInputElement>,
    ) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith("image/")) {
            setError("Vui lòng chọn file ảnh (png/jpg/webp...).");
            return;
        }
        if (file.size > MAX_AVATAR_FILE_BYTES) {
            setError("Ảnh đại diện tối đa 2MB.");
            return;
        }

        setError(null);
        try {
            const dataUrl = await optimizeAvatarDataUrl(file);
            if (dataUrlPayloadBytes(dataUrl) > MAX_AVATAR_PAYLOAD_BYTES) {
                setError(
                    "Ảnh quá lớn sau khi xử lý. Vui lòng chọn ảnh nhỏ hơn hoặc đổi định dạng khác.",
                );
                return;
            }
            setAvatarDataUrl(dataUrl);
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "Không thể đọc file ảnh.",
            );
        }
    };

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setError(null);
        setReviewerProfileError(null);
        setSuccess(null);

        if (!canEdit) {
            setError("Bạn cần kết nối ví và đăng nhập để cập nhật hồ sơ.");
            return;
        }

        setIsSaving(true);
        try {
            const updated = await updateUserProfile(token, walletAddress, {
                displayName: displayName.trim(),
                avatarUrl: avatarDataUrl.trim(),
            });

            if (isReviewer && !isReviewerRoleLoading) {
                await updateReviewerProfile(token, {
                    organizationName: organizationName.trim(),
                    region: region.trim(),
                });
            }

            if (token) {
                setAuth(token, toAuthUserProfile(updated));
            }
            setSuccess("Đã lưu thông tin hồ sơ thành công.");
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "Cập nhật hồ sơ thất bại.",
            );
        } finally {
            setIsSaving(false);
        }
    };

    if (!isMounted) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
                <main className="mx-auto w-full max-w-3xl px-6 py-12 md:px-10">
                    <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
                        <h1 className="text-2xl font-bold text-slate-900">
                            Hồ sơ &amp; cài đặt
                        </h1>
                        <p className="mt-3 text-sm text-slate-600">
                            Đang tải...
                        </p>
                    </div>
                </main>
            </div>
        );
    }

    if (!isConnected || !address) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
                <main className="mx-auto w-full max-w-3xl px-6 py-12 md:px-10">
                    <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
                        <h1 className="text-2xl font-bold text-slate-900">
                            Hồ sơ &amp; cài đặt
                        </h1>
                        <p className="mt-3 text-sm text-slate-600">
                            Bạn cần kết nối ví để quản lý hồ sơ cá nhân.
                        </p>
                        <Link
                            href="/campaigns"
                            className="mt-5 inline-flex rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                        >
                            Xem chiến dịch công khai
                        </Link>
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
            <main className="mx-auto w-full max-w-3xl px-6 py-12 md:px-10">
                <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
                    <h1 className="text-2xl font-bold text-slate-900">
                        Hồ sơ &amp; cài đặt
                    </h1>
                    <p className="mt-2 text-sm text-slate-600">
                        Cập nhật tên hiển thị và ảnh đại diện. Nếu bạn là
                        reviewer, bổ sung tên tổ chức và tỉnh/thành phụ trách.
                    </p>

                    <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                            Ví đang dùng
                        </p>
                        <p className="mt-1 font-mono text-sm text-slate-800 break-all">
                            {walletAddress}
                        </p>
                        <p className="mt-2 text-xs text-slate-500">
                            Vai trò: {user?.role || "user"}
                        </p>
                    </div>

                    {isLoading ? (
                        <p className="mt-6 text-sm text-slate-600">
                            Đang tải hồ sơ...
                        </p>
                    ) : (
                        <form
                            onSubmit={handleSubmit}
                            className="mt-6 space-y-5"
                        >
                            <div>
                                <label
                                    htmlFor="displayName"
                                    className="mb-2 block text-sm font-semibold text-slate-700"
                                >
                                    Tên hiển thị
                                </label>
                                <input
                                    id="displayName"
                                    type="text"
                                    value={displayName}
                                    onChange={(e) =>
                                        setDisplayName(e.target.value)
                                    }
                                    maxLength={100}
                                    placeholder="Ví dụ: Nguyen Van A"
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                />
                            </div>

                            <div>
                                <label
                                    htmlFor="avatarFile"
                                    className="mb-2 block text-sm font-semibold text-slate-700"
                                >
                                    Ảnh đại diện
                                </label>
                                <input
                                    id="avatarFile"
                                    type="file"
                                    accept="image/*"
                                    onChange={handleAvatarFileChange}
                                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 file:mr-3 file:rounded-md file:border-0 file:bg-blue-600 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-blue-700"
                                />
                                <p className="mt-1 text-xs text-slate-500">
                                    Hỗ trợ ảnh PNG/JPG/WEBP, tối đa 2MB.
                                </p>
                                {avatarDataUrl && (
                                    <div className="mt-3 flex items-center gap-3">
                                        <img
                                            src={avatarDataUrl}
                                            alt="Xem trước ảnh đại diện"
                                            className="h-14 w-14 rounded-full border border-slate-200 object-cover"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setAvatarDataUrl("")}
                                            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                        >
                                            Xóa ảnh
                                        </button>
                                    </div>
                                )}
                            </div>

                            {isReviewer &&
                                !isReviewerRoleLoading &&
                                !isLoadingReviewerProfile && (
                                    <>
                                        <div>
                                            <label
                                                htmlFor="organizationName"
                                                className="mb-2 block text-sm font-semibold text-slate-700"
                                            >
                                                Tên tổ chức
                                            </label>
                                            <input
                                                id="organizationName"
                                                type="text"
                                                value={organizationName}
                                                onChange={(e) =>
                                                    setOrganizationName(
                                                        e.target.value,
                                                    )
                                                }
                                                maxLength={200}
                                                placeholder="Ví dụ: Sở Giáo dục TP.HCM"
                                                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                            />
                                        </div>
                                        <div>
                                            <label
                                                htmlFor="region"
                                                className="mb-2 block text-sm font-semibold text-slate-700"
                                            >
                                                Tỉnh / thành phố
                                            </label>
                                            <input
                                                id="region"
                                                type="text"
                                                value={region}
                                                onChange={(e) =>
                                                    setRegion(e.target.value)
                                                }
                                                maxLength={200}
                                                placeholder="Ví dụ: TP. Hồ Chí Minh"
                                                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                            />
                                        </div>
                                    </>
                                )}

                            {error && (
                                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                                    {error}
                                </p>
                            )}
                            {success && (
                                <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                                    {success}
                                </p>
                            )}

                            <button
                                type="submit"
                                disabled={
                                    !canEdit ||
                                    isSaving ||
                                    (isReviewer &&
                                        (isReviewerRoleLoading ||
                                            isLoadingReviewerProfile))
                                }
                                className="inline-flex rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {isSaving ? "Đang lưu..." : "Lưu thay đổi"}
                            </button>
                        </form>
                    )}
                </div>
            </main>
        </div>
    );
}
