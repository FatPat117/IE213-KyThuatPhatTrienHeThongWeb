"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
    getPublicCampaignMilestones,
    PublicCampaignMilestone,
} from "@/lib/api/campaigns";
import { buildTimelineMilestones } from "@/lib/utils/milestone-plan";
import { formatEther } from "viem";

interface MilestonePreviewCardProps {
    campaignId: number;
    campaignDeadline: number;
    campaignCreatedAt?: string;
    progressPercent: number;
    goalWei?: bigint;
    raisedWei?: bigint;
    disbursedWei?: bigint;
    milestoneCount?: bigint | number;
    campaignStatusLabel?:
        | "pending_approval"
        | "active"
        | "in_progress"
        | "completed"
        | "partial_failed"
        | "failed"
        | "cancelled";
    currentMilestoneId?: number;
    userDonatedWei?: bigint;
    milestones?: PublicCampaignMilestone[];
}

function formatDate(value: Date) {
    return new Intl.DateTimeFormat("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    }).format(value);
}

function getStatusBadgeColor(status: string): string {
    switch (status) {
        case "disbursed":
        case "completed":
            return "bg-emerald-100 text-emerald-700";
        case "submitted":
        case "pending_verification":
        case "in_progress":
            return "bg-blue-100 text-blue-700";
        case "resubmittable":
            return "bg-orange-100 text-orange-700";
        case "deadline_exceeded":
        case "verification_failed":
        case "failed":
        case "cancelled":
        case "delayed":
            return "bg-red-100 text-red-700";
        default:
            return "bg-slate-200 text-slate-600";
    }
}

function getStatusLabel(status: string): string {
    switch (status) {
        case "approved":
            return "Đã hoàn thành";
        case "disbursed":
        case "completed":
            return "Đã giải ngân";
        case "submitted":
            return "Đã nộp minh chứng";
        case "pending_verification":
            return "Chờ xét duyệt";
        case "in_progress":
            return "Đang thực hiện";
        case "deadline_exceeded":
        case "delayed":
            return "Quá hạn";
        case "verification_failed":
            return "Bị từ chối duyệt";
        case "failed":
            return "Thất bại";
        case "cancelled":
            return "Đã dừng";
        case "upcoming":
            return "Sắp tới";
        case "pending_funding":
            return "Chờ đủ vốn";
        case "resubmittable":
            return "Cần nộp lại";
        default:
            return "Chưa nộp báo cáo";
    }
}

export default function MilestonePreviewCard({
    campaignId,
    campaignDeadline,
    campaignCreatedAt,
    progressPercent,
    goalWei = 0n,
    raisedWei = 0n,
    disbursedWei = 0n,
    userDonatedWei = 0n,
    milestoneCount,
    campaignStatusLabel,
    currentMilestoneId,
    milestones: propMilestones = [],
}: MilestonePreviewCardProps) {
    const [apiMilestones, setApiMilestones] = useState<
        PublicCampaignMilestone[]
    >(propMilestones);
    const [isLoading, setIsLoading] = useState(propMilestones.length === 0);
    const [isAwaitingIndex, setIsAwaitingIndex] = useState(false);
    const expectedMilestoneCount = Math.max(0, Number(milestoneCount || 0));
    
    const fallbackMilestones = buildTimelineMilestones({
        campaignId,
        campaignDeadline,
        campaignCreatedAt,
        progressPercent,
        goalWei,
        totalRaisedWei: raisedWei,
        milestoneCount: milestoneCount !== undefined ? Number(milestoneCount) : undefined,
        campaignStatusLabel,
        currentMilestoneId,
    });

    // Update state if prop changes
    useEffect(() => {
        if (propMilestones.length > 0) {
            setApiMilestones(propMilestones);
            setIsLoading(false);
        }
    }, [propMilestones]);

    // Fetch real milestones from API if prop is empty
    useEffect(() => {
        if (propMilestones.length > 0) return;

        let cancelled = false;
        const fetchMilestones = async () => {
            try {
                setIsLoading(true);
                const data = await getPublicCampaignMilestones(campaignId);
                if (!cancelled) {
                    const fetched = data.milestones || [];
                    setApiMilestones(fetched);
                    setIsAwaitingIndex(
                        expectedMilestoneCount > 0 && fetched.length === 0,
                    );
                }
            } catch {
                if (!cancelled) {
                    setApiMilestones([]);
                    setIsAwaitingIndex(expectedMilestoneCount > 0);
                }
            } finally {
                if (!cancelled) {
                    setIsLoading(false);
                }
            }
        };

        if (campaignId > 0) {
            fetchMilestones();
        }

        return () => {
            cancelled = true;
        };
    }, [campaignId, expectedMilestoneCount, propMilestones.length]);

    useEffect(() => {
        if (!isAwaitingIndex || campaignId <= 0) return;

        const retryTimer = window.setInterval(() => {
            getPublicCampaignMilestones(campaignId)
                .then((data) => {
                    const milestones = data.milestones || [];
                    setApiMilestones(milestones);
                    setIsAwaitingIndex(
                        expectedMilestoneCount > 0 && milestones.length === 0,
                    );
                })
                .catch(() => {});
        }, 5000);

        return () => {
            window.clearInterval(retryTimer);
        };
    }, [campaignId, expectedMilestoneCount, isAwaitingIndex]);

    const hasMilestones =
        apiMilestones.length > 0 || fallbackMilestones.length > 0;
    
    const milestonesToRender =
        apiMilestones.length > 0
            ? apiMilestones
            : isAwaitingIndex
              ? []
              : fallbackMilestones;

    if (!hasMilestones) {
        return null;
    }

    return (
        <Link
            href={`/campaigns/${campaignId}/milestones`}
            className="group block"
        >
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition duration-200 hover:border-blue-300 hover:shadow-md">
                <div className="border-b border-blue-100 bg-gradient-to-r from-blue-50 to-indigo-50 px-8 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-xl font-bold text-slate-900">
                            Các mốc giải ngân dự kiến
                        </h3>
                        <span className="inline-flex items-center rounded-full bg-white px-3 py-1 text-xs font-semibold text-blue-700 ring-1 ring-blue-100">
                            Xem timeline chi tiết →
                        </span>
                    </div>
                    <p className="mt-2 text-sm text-slate-600">
                        Thông tin giúp nhà tài trợ đánh giá mức độ minh bạch và
                        kế hoạch sử dụng quỹ trước khi quyên góp.
                    </p>
                </div>

                <div className="p-8">
                    <div className="mb-5 flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-slate-600">
                            Tiến độ chiến dịch hiện tại
                        </p>
                        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                            {progressPercent.toFixed(1)}%
                        </span>
                    </div>

                    <div className="mb-6 h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
                        <div
                            className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-500"
                            style={{ width: `${progressPercent}%` }}
                        />
                    </div>

                    {isLoading && apiMilestones.length === 0 && (
                        <div className="space-y-3">
                            {[1, 2, 3].map((i) => (
                                <div
                                    key={i}
                                    className="rounded-xl border border-slate-200 bg-slate-50 p-4 animate-pulse"
                                >
                                    <div className="h-4 w-2/3 bg-slate-200 rounded mb-2" />
                                    <div className="h-3 w-full bg-slate-200 rounded mb-2" />
                                    <div className="h-3 w-1/3 bg-slate-200 rounded" />
                                </div>
                            ))}
                        </div>
                    )}

                    {!isLoading && (
                        <div className="space-y-3">
                            {milestonesToRender.map((milestone) => {
                                const isApiMilestone = "milestoneId" in milestone;
                                const title = milestone.title || "";
                                const allocationPercent = isApiMilestone
                                    ? Math.floor((Number(milestone.allocationBps) / 10000) * 100)
                                    : (milestone as any).allocationPercent;
                                const status = milestone.status;

                                const amountText = (() => {
                                     try {
                                         // CHỈ lấy từ Backend, không tự tính toán lại ở Frontend
                                         const rawWei = "amountWei" in milestone ? milestone.amountWei : undefined;
                                         const wei = BigInt(rawWei || "0");
                                         const eth = Number(formatEther(wei));
                                         
                                         if (eth <= 0) return "";
                                         
                                         const formatted = (eth % 0.01 !== 0)
                                           ? eth.toFixed(4).replace(/\.?0+$/, "")
                                           : eth.toFixed(2);
                                         
                                         return `${formatted} ETH`;
                                     } catch { return ""; }
                                 })();

                                const refundText = (() => {
                                    try {
                                        if (!isApiMilestone) return null;
                                        const bps = Number(milestone.allocationBps || 0);
                                        const apiM = milestone as PublicCampaignMilestone;
                                        const milestoneGoalWei = (apiM.amountWei && apiM.amountWei !== "0")
                                            ? BigInt(apiM.amountWei)
                                            : (goalWei * BigInt(bps)) / 10000n;

                                        const raisedForMilestone = (raisedWei > 0n && bps > 0)
                                            ? (raisedWei * BigInt(bps)) / 10000n
                                            : 0n;

                                        if (status === "disbursed" || status === "completed") return null;
                                        if (raisedForMilestone === 0n) return null;

                                        const refundEth = Number(formatEther(raisedForMilestone));
                                        const formatted = refundEth % 0.01 !== 0
                                            ? refundEth.toFixed(4).replace(/\.?0+$/, "")
                                            : refundEth.toFixed(2);
                                        
                                        let userRefundText = null;
                                        if (userDonatedWei > 0n && raisedWei > 0n) {
                                            const userRefundWei = (userDonatedWei * raisedForMilestone) / raisedWei;
                                            if (userRefundWei > 0n) {
                                                const uEth = Number(formatEther(userRefundWei));
                                                userRefundText = uEth % 0.01 !== 0
                                                    ? uEth.toFixed(4).replace(/\.?0+$/, "")
                                                    : uEth.toFixed(2);
                                            }
                                        }

                                        return {
                                            total: `${formatted} ETH`,
                                            user: userRefundText ? `${userRefundText} ETH` : null
                                        };
                                    } catch { return null; }
                                })();

                                return (
                                    <article
                                        key={isApiMilestone ? (milestone as any).milestoneId : (milestone as any).id}
                                        className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                                    >
                                        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                                            <p className="font-semibold text-slate-900">
                                                {title}
                                            </p>
                                            <div className="flex items-center gap-2 text-xs font-semibold">
                                                <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-emerald-700">
                                                    {allocationPercent}% ngân sách
                                                </span>
                                                <span className={`rounded-full px-2.5 py-1 ${getStatusBadgeColor(status)}`}>
                                                    {getStatusLabel(status)}
                                                </span>
                                            </div>
                                        </div>

                                        <p className="mb-2 text-sm leading-relaxed text-slate-600">
                                            {milestone.description}
                                        </p>

                                        {amountText && (
                                            <p className="mb-2 text-xs font-medium text-slate-500">
                                                Số tiền:{" "}
                                                <span className="text-slate-700">
                                                    {amountText}
                                                </span>
                                            </p>
                                        )}

                                        {isApiMilestone && milestone.deadline && (
                                            <p className="text-xs font-medium text-slate-500">
                                                Hạn chót dự kiến:{" "}
                                                <span className="text-slate-700">
                                                    {formatDate(new Date(milestone.deadline))}
                                                </span>
                                            </p>
                                        )}

                                        {refundText && (
                                            <div className="mt-2 space-y-1">
                                                <p className="text-xs font-semibold text-amber-600">
                                                    Hoàn trả tối đa:{" "}
                                                    <span className="text-amber-700">
                                                        {refundText.total}
                                                    </span>
                                                </p>
                                                {refundText.user && (
                                                    <p className="text-[10px] font-bold text-amber-700">
                                                        Của bạn: {refundText.user}
                                                    </p>
                                                )}
                                            </div>
                                        )}

                                        {!isApiMilestone && (milestone as any).expectedDate && (
                                            <p className="text-xs font-medium text-slate-500">
                                                Hạn chót dự kiến:{" "}
                                                <span className="text-slate-700">
                                                    {formatDate((milestone as any).expectedDate)}
                                                </span>
                                            </p>
                                        )}
                                    </article>
                                );
                            })}
                        </div>
                    )}

                    {!isLoading && isAwaitingIndex && (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                            Milestone đang được backend đồng bộ sau khi tạo
                            campaign. Dữ liệu thật sẽ tự cập nhật trong vài giây.
                        </div>
                    )}

                    <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
                        <p className="text-sm font-semibold text-amber-900">
                            Chú thích về giải ngân theo giai đoạn
                        </p>
                        <p className="mt-1 text-sm leading-relaxed text-amber-800">
                            Tiền quỹ không được rút một lần. Mỗi đợt giải ngân
                            cần được mở khóa theo mốc tiến độ và được đối soát
                            minh chứng kết quả. Cách này giúp nhà tài trợ giảm
                            rủi ro và tăng tính minh bạch trước khi quyết định
                            quyên góp.
                        </p>
                    </div>
                </div>
            </section>
        </Link>
    );
}
