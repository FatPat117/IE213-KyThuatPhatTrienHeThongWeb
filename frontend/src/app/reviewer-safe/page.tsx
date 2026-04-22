"use client";

import { useMemo } from "react";
import { useReadReviewerSafesOnChain } from "@/lib";

function shorten(value: string) {
    return `${value.slice(0, 8)}...${value.slice(-6)}`;
}

export default function ReviewerSafePage() {
    const { reviewerSafes, isLoading, error } = useReadReviewerSafesOnChain();
    const items = useMemo(
        () => reviewerSafes.filter((item) => /^0x[a-f0-9]{40}$/.test(item)),
        [reviewerSafes],
    );

    return (
        <div className="min-h-screen bg-slate-50 px-6 py-10">
            <main className="mx-auto max-w-5xl rounded-2xl border border-slate-200 bg-white p-6">
                <h1 className="text-2xl font-bold text-slate-900">
                    Danh sách Reviewer Safe
                </h1>
                <p className="mt-1 text-sm text-slate-600">
                    Danh sách whitelist được đọc trực tiếp từ smart contract.
                </p>
                {isLoading && <p className="mt-4 text-sm text-slate-600">Đang tải...</p>}
                {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {items.map((safe) => (
                        <div
                            key={safe}
                            className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
                        >
                            <p className="text-sm font-semibold text-slate-800">
                                {shorten(safe)}
                            </p>
                            <p className="mt-1 break-all text-xs text-slate-600">
                                {safe}
                            </p>
                        </div>
                    ))}
                </div>
            </main>
        </div>
    );
}
