"use client";

import { formatEther } from "viem";

interface CampaignInfoPanelProps {
    campaign: {
        id: number;
        title: string;
        description: string;
        creator: string;
        beneficiary?: string;
        goal: bigint;
        raised: bigint;
        totalRaised?: bigint;
        totalDisbursed?: bigint;
        deadline: number;
        completed: boolean;
        statusLabel?:
            | "active"
            | "in_progress"
            | "completed"
            | "partial_failed"
            | "failed"
            | "cancelled"
            | "pending_approval";
    };
    userDonatedWei?: bigint;
    backendDescription?: string;
    backendTitle?: string;
    reviewerSafe?: string;
    /** Beneficiary nhập lúc tạo campaign, lưu localStorage (chưa có on-chain nếu contract chưa hỗ trợ). */
    declaredBeneficiary?: string;
    progress: number;
    thumbnailUrl?: string | null;
}

function formatEthAmount(value: number) {
    if (!Number.isFinite(value) || value <= 0) return "0";
    if (value % 0.01 !== 0) return value.toFixed(4).replace(/\.?0+$/, "");
    return value.toFixed(2);
}

function getStatusBadge(
    statusLabel?: CampaignInfoPanelProps["campaign"]["statusLabel"],
    completed?: boolean,
) {
    switch (statusLabel) {
        case "pending_approval":
            return {
                className: "bg-amber-100 text-amber-700",
                label: "● Chờ duyệt",
            };
        case "active":
            return {
                className: "bg-emerald-100 text-emerald-700",
                label: "● Đang kêu gọi",
            };
        case "in_progress":
            return {
                className: "bg-blue-100 text-blue-700",
                label: "Đang triển khai milestone",
            };
        case "completed":
            return {
                className: "bg-green-100 text-green-700",
                label: "Đã hoàn thành",
            };
        case "partial_failed":
            return {
                className: "bg-amber-100 text-amber-700",
                label: "Thất bại một phần",
            };
        case "failed":
            return {
                className: "bg-rose-100 text-rose-700",
                label: "Thất bại gây quỹ",
            };
        case "cancelled":
            return {
                className: "bg-slate-200 text-slate-700",
                label: "Đã hủy",
            };
        default:
            return completed
                ? {
                      className: "bg-slate-100 text-slate-600",
                      label: "Đã kết thúc",
                  }
                : {
                      className: "bg-green-100 text-green-700",
                      label: "● Đang hoạt động",
                  };
    }
}

/**
 * Main campaign overview block (title, creator, stats, progress).
 */
    export default function CampaignInfoPanel({
    campaign,
    backendDescription,
    backendTitle,
    reviewerSafe,
    declaredBeneficiary,
    progress,
    thumbnailUrl,
    userDonatedWei = 0n,
}: CampaignInfoPanelProps) {
    const goalEth = Number(formatEther(campaign.goal));
    const raisedEth = Number(formatEther(campaign.raised));
    const totalRaisedWei = campaign.totalRaised ?? campaign.raised;
    const totalDisbursedWei = campaign.totalDisbursed ?? 0n;
    const remainingWei = totalRaisedWei > totalDisbursedWei ? totalRaisedWei - totalDisbursedWei : 0n;

    // Tính toán số tiền user sẽ nhận lại
    const userRefundWei = (totalRaisedWei > 0n && userDonatedWei > 0n)
        ? (userDonatedWei * remainingWei) / totalRaisedWei
        : 0n;

    const statusBadge = getStatusBadge(
        campaign.statusLabel,
        campaign.completed,
    );

    return (
        <div className="rounded-2xl bg-white border border-slate-200 p-8 shadow-sm">

            {thumbnailUrl && (
                <div className="w-full h-56 sm:h-64 bg-slate-100 overflow-hidden">
                    <img
                        src={thumbnailUrl}
                        alt={`Thumbnail chiến dịch ${backendTitle || campaign.title || `Campaign ${campaign.id}`}`}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                            (e.currentTarget as HTMLImageElement).style.display = 'none';
                        }}
                    />
                </div>
            )}

            <div className="mb-6">
                <h2 className="mb-3 break-words text-3xl font-bold text-slate-900">
                    {backendTitle ||
                        campaign.title ||
                        `Campaign ${campaign.id}`}
                </h2>
                <div className="mb-3 flex justify-start sm:justify-end">
                    <span
                        className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold ${statusBadge.className}`}
                    >
                        {statusBadge.label}
                    </span>
                </div>
                <p className="text-slate-600 leading-relaxed">
                    {backendDescription ||
                        campaign.description ||
                        "Chiến dịch này sử dụng hợp đồng thông minh để gây quỹ minh bạch."}
                </p>
            </div>

            <div className="rounded-xl bg-slate-50 p-4 mb-6">
                <p className="text-sm font-medium text-slate-600 mb-1">
                    Người tạo campaign
                </p>
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600" />
                    <code className="text-sm font-mono text-slate-900">
                        {campaign.creator.slice(0, 6)}...
                        {campaign.creator.slice(-4)}
                    </code>
                    <a
                        href={`https://sepolia.etherscan.io/address/${campaign.creator}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-auto text-xs font-medium text-blue-600 hover:text-blue-700"
                    >
                        Xem trên explorer →
                    </a>
                </div>
            </div>

            {declaredBeneficiary &&
                /^0x[a-f0-9]{40}$/i.test(declaredBeneficiary) && (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/90 p-4 mb-6">
                        <p className="text-sm font-medium text-slate-700 mb-1">
                            Người nhận tiền (bạn đã khai báo)
                        </p>
                        <p className="text-xs text-slate-500 mb-2">
                            Lưu trên trình duyệt này khi tạo chiến dịch. Contract hiện tại có thể chưa ghi nhận địa chỉ này on-chain.
                        </p>
                        <div className="flex items-center gap-2">
                            <code className="text-sm font-mono text-slate-900 break-all">
                                {declaredBeneficiary.slice(0, 10)}...
                                {declaredBeneficiary.slice(-8)}
                            </code>
                            <a
                                href={`https://sepolia.etherscan.io/address/${declaredBeneficiary}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="ml-auto text-xs font-medium text-slate-600 hover:text-slate-800 whitespace-nowrap"
                            >
                                Explorer →
                            </a>
                        </div>
                    </div>
                )}

            {campaign.beneficiary &&
                /^0x[a-f0-9]{40}$/i.test(campaign.beneficiary) &&
                campaign.beneficiary.toLowerCase() !==
                    "0x0000000000000000000000000000000000000000" && (
                    <div className="rounded-xl bg-emerald-50/80 border border-emerald-100 p-4 mb-6">
                        <p className="text-sm font-medium text-emerald-800 mb-1">
                            Người nhận tiền (beneficiary)
                        </p>
                        <p className="text-xs text-emerald-700/90 mb-2">
                            Địa chỉ nhận giải ngân milestone theo hợp đồng.
                        </p>
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600" />
                            <code className="text-sm font-mono text-slate-900 break-all">
                                {campaign.beneficiary.slice(0, 8)}...
                                {campaign.beneficiary.slice(-6)}
                            </code>
                            <a
                                href={`https://sepolia.etherscan.io/address/${campaign.beneficiary}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="ml-auto text-xs font-medium text-emerald-700 hover:text-emerald-800 whitespace-nowrap"
                            >
                                Xem ví →
                            </a>
                        </div>
                    </div>
                )}

            {/* Reviewer Safe */}
            {reviewerSafe && /^0x[a-f0-9]{40}$/i.test(reviewerSafe) && (
                <div className="rounded-xl bg-violet-50 border border-violet-100 p-4 mb-6">
                    <p className="text-sm font-medium text-violet-600 mb-1">
                        Reviewer (Gnosis Safe)
                    </p>
                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-400 to-violet-600 flex-shrink-0" />
                        <code className="text-sm font-mono text-slate-900 break-all">
                            {reviewerSafe.slice(0, 8)}...{reviewerSafe.slice(-6)}
                        </code>
                        <a
                            href={`https://sepolia.etherscan.io/address/${reviewerSafe}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-auto text-xs font-medium text-violet-600 hover:text-violet-700 whitespace-nowrap"
                        >
                            Xem Safe →
                        </a>
                    </div>
                </div>
            )}

            {/* Funding Deadline */}
            {campaign.deadline > 0 && (
                <div className="rounded-xl bg-slate-50 border border-slate-100 p-4 mb-6 flex items-center justify-between">
                    <p className="text-sm font-medium text-slate-600">Hạn gây quỹ</p>
                    <p className="text-sm font-semibold text-slate-900" suppressHydrationWarning>
                        {new Date(campaign.deadline * 1000).toLocaleString("vi-VN")}
                    </p>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="rounded-xl bg-blue-50 border border-blue-100 p-5">
                    <p className="text-sm font-medium text-blue-600 mb-2">
                        Mục tiêu gây quỹ
                    </p>
                    <p className="text-2xl font-bold text-slate-900">
                        {formatEthAmount(goalEth)}{" "}
                        <span className="text-base font-normal text-slate-600">
                            ETH
                        </span>
                    </p>
                </div>
                <div className="rounded-xl bg-green-50 border border-green-100 p-5">
                    <p className="text-sm font-medium text-green-600 mb-2">
                        Tổng đã huy động
                    </p>
                    <p className="text-2xl font-bold text-slate-900">
                        {formatEthAmount(raisedEth)}{" "}
                        <span className="text-base font-normal text-slate-600">
                            ETH
                        </span>
                    </p>
                </div>
                <div className="rounded-xl bg-amber-50 border border-amber-100 p-5">
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium text-amber-600">
                            Hoàn lại nếu thất bại
                        </p>
                        <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase">
                            {totalRaisedWei > 0n 
                                ? `${((Number(remainingWei) * 100) / Number(totalRaisedWei)).toFixed(0)}%` 
                                : "100%"}
                        </span>
                    </div>
                    <p className="text-2xl font-bold text-slate-900">
                        {formatEthAmount(Number(formatEther(remainingWei)))}{" "}
                        <span className="text-base font-normal text-slate-600">
                            ETH
                        </span>
                    </p>
                    {userDonatedWei > 0n && (
                        <div className="mt-3 pt-3 border-t border-amber-200/50">
                            <p className="text-[11px] text-amber-700 font-medium mb-1">Của riêng bạn (dự kiến):</p>
                            <p className="text-sm font-bold text-amber-900">
                                {formatEthAmount(Number(formatEther(userRefundWei)))} ETH
                            </p>
                        </div>
                    )}
                </div>
            </div>

            <div>
                <div className="flex items-center justify-between text-sm mb-2">
                    <span className="font-semibold text-slate-900">
                        Đã đạt {progress.toFixed(1)}%
                    </span>
                    <span className="text-slate-600">
                        {formatEthAmount(raisedEth)} /{" "}
                        {formatEthAmount(goalEth)} ETH
                    </span>
                </div>
                <div className="h-3 w-full rounded-full bg-slate-200 overflow-hidden">
                    <div
                        className={`h-full rounded-full transition-all duration-500 ${
                            progress >= 100 ? "bg-green-500" : "bg-blue-600"
                        }`}
                        style={{ width: `${progress}%` }}
                    />
                </div>
            </div>
        </div>
    );
}
