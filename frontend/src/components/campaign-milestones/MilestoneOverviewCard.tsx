"use client";

import { formatEther } from "viem";
import type { PublicCampaignMilestone } from "@/lib/api/campaigns";

interface MilestoneOverviewCardProps {
    progressPercent: number;
    milestones: PublicCampaignMilestone[];
    goalWei: bigint;
    raisedWei: bigint;
}

function formatEthAmount(value: number) {
    if (!Number.isFinite(value) || value <= 0) return "0";
    if (value < 0.01) return value.toFixed(4).replace(/\.?0+$/, "");
    return value.toFixed(2);
}

export default function MilestoneOverviewCard({
    progressPercent,
    milestones,
    goalWei,
    raisedWei,
}: MilestoneOverviewCardProps) {
    const completedCount = milestones.filter(
        (item) => item.status === "disbursed",
    ).length;
    const issueCount = milestones.filter((item) =>
        ["deadline_exceeded", "failed", "refunded"].includes(item.status),
    ).length;
    const inProgressCount = milestones.filter((item) => {
        return [
            "pending_verification",
            "submitted",
            "resubmittable",
            "review_timeout",
            "approved",
        ].includes(item.status);
    }).length;

    const goalEth = formatEthAmount(Number(formatEther(goalWei)));
    const raisedEth = formatEthAmount(Number(formatEther(raisedWei)));

    return (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-blue-50 px-6 py-5">
                <p className="text-sm font-medium text-slate-600">
                    Tổng tiến trình giải ngân dự kiến
                </p>
                <p className="mt-1 text-4xl font-extrabold tracking-tight text-slate-900">
                    {progressPercent.toFixed(1)}%
                </p>
            </div>

            <div className="space-y-5 px-6 py-5">
                <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-5">
                    <div className="rounded-xl bg-slate-50 px-4 py-3">
                        <p className="text-xs text-slate-500">Số mốc</p>
                        <p className="text-base font-semibold text-slate-900">
                            {milestones.length}
                        </p>
                    </div>
                    <div className="rounded-xl bg-emerald-50 px-4 py-3">
                        <p className="text-xs text-emerald-700">Hoàn thành</p>
                        <p className="text-base font-semibold text-emerald-800">
                            {completedCount}
                        </p>
                    </div>
                    <div className="rounded-xl bg-blue-50 px-4 py-3">
                        <p className="text-xs text-blue-700">Đang chạy</p>
                        <p className="text-base font-semibold text-blue-800">
                            {inProgressCount}
                        </p>
                    </div>
                    <div className="rounded-xl bg-rose-50 px-4 py-3">
                        <p className="text-xs text-rose-700">Issues</p>
                        <p className="text-base font-semibold text-rose-800">
                            {issueCount}
                        </p>
                    </div>
                    <div className="rounded-xl bg-indigo-50 px-4 py-3">
                        <p className="text-xs text-indigo-700">Mục tiêu quỹ</p>
                        <p className="text-base font-semibold text-indigo-800">
                            {goalEth} ETH
                        </p>
                    </div>
                </div>

                <div>
                    <div className="mb-2 flex items-center justify-between text-sm">
                        <span className="font-semibold text-slate-900">
                            Tiến độ tổng thể
                        </span>
                        <span className="text-slate-600">
                            {raisedEth} / {goalEth} ETH
                        </span>
                    </div>
                    <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200">
                        <div
                            className="h-full rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-cyan-500 transition-all duration-500"
                            style={{ width: `${progressPercent}%` }}
                        />
                    </div>
                </div>

                <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600">
                    Trạng thái mốc được suy luận từ phần trăm quyên góp hiện tại
                    và hạn chót dự kiến của từng giai đoạn. Đây là thông tin
                    tham chiếu để nhà tài trợ đánh giá mức độ minh bạch trước
                    khi quyên góp.
                </p>
            </div>
        </section>
    );
}
