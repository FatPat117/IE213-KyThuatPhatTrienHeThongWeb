"use client";

import { formatEther } from "viem";

interface CampaignInfoPanelProps {
    campaign: {
        id: number;
        title: string;
        description: string;
        creator: string;
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
    beneficiary?: string;
    progress: number;
    thumbnailUrl?: string | null;
    rejectionReason?: string | null;
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
                className: "border border-amber-400/35 bg-amber-500/15 text-amber-200",
                label: "● Chờ duyệt",
            };
        case "active":
            return {
                className: "border border-emerald-400/35 bg-emerald-500/15 text-emerald-200",
                label: "● Đang kêu gọi",
            };
        case "in_progress":
            return {
                className: "border border-indigo-400/35 bg-indigo-500/15 text-indigo-200",
                label: "Đang triển khai các mốc",
            };
        case "completed":
            return {
                className: "border border-emerald-400/35 bg-emerald-500/15 text-emerald-200",
                label: "Đã hoàn thành kêu gọi",
            };
        case "partial_failed":
            return {
                className: "border border-amber-400/35 bg-amber-500/15 text-amber-200",
                label: "Thất bại một phần",
            };
        case "failed":
            return {
                className: "border border-rose-400/35 bg-rose-500/15 text-rose-200",
                label: "Thất bại gây quỹ",
            };
        case "cancelled":
            return {
                className: "border border-white/15 bg-white/5 text-slate-300",
                label: "Đã hủy",
            };
        default:
            return completed
                ? {
                      className: "border border-white/15 bg-white/5 text-slate-300",
                      label: "Đã kết thúc",
                  }
                : {
                      className: "border border-emerald-400/35 bg-emerald-500/15 text-emerald-200",
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
    beneficiary,
    progress,
    thumbnailUrl,
    userDonatedWei = 0n,
    rejectionReason,
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
        <div className="web3-glass-card overflow-hidden rounded-2xl p-8">

            <div className="relative h-56 w-full overflow-hidden bg-white/5 sm:h-64 group/thumb">
                {thumbnailUrl ? (
                    <img
                        src={thumbnailUrl}
                        alt={`Thumbnail chiến dịch ${backendTitle || campaign.title || `Campaign ${campaign.id}`}`}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover/thumb:scale-105"
                        onError={(e) => {
                            // If image fails, replace with a nice fallback div
                            const target = e.currentTarget as HTMLImageElement;
                            target.style.display = 'none';
                            const parent = target.parentElement;
                            if (parent) {
                                const fallback = document.createElement('div');
                                fallback.className = "w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 text-slate-400";
                                fallback.innerHTML = '<span class="text-4xl mb-2">🖼️</span><span class="text-xs font-medium">Không thể tải ảnh</span>';
                                parent.appendChild(fallback);
                            }
                        }}
                    />
                ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-indigo-500/15 to-cyan-500/10 text-indigo-300">
                        <span className="mb-2 text-5xl">✨</span>
                        <span className="text-xs font-semibold uppercase tracking-wider text-indigo-300/70">
                            Crowdfunding Campaign
                        </span>
                    </div>
                )}
                
                {/* Decorative overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
            </div>

            <div className="mb-6">
                <h2 className="mb-3 break-words text-3xl font-bold text-[var(--text-primary)]">
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
                <p className="leading-relaxed text-[var(--text-secondary)]">
                    {backendDescription ||
                        campaign.description ||
                        "Chiến dịch này sử dụng hợp đồng thông minh để gây quỹ minh bạch."}
                </p>

                {campaign.statusLabel === "cancelled" && rejectionReason && (
                    <div className="mt-4 rounded-xl border border-rose-400/30 bg-rose-500/10 p-4">
                        <p className="mb-1 text-xs font-bold uppercase tracking-wider text-rose-300">
                            Lý do từ chối từ Admin:
                        </p>
                        <p className="text-sm italic text-rose-100/90">
                            &quot;{rejectionReason}&quot;
                        </p>
                    </div>
                )}
            </div>

            <div className="mb-6 rounded-xl border border-white/10 bg-white/5 p-4">
                <p className="mb-1 text-sm font-medium text-[var(--text-secondary)]">
                    Người tạo chiến dịch
                </p>
                <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600" />
                    <code className="text-sm font-mono text-slate-200">
                        {campaign.creator.slice(0, 6)}...
                        {campaign.creator.slice(-4)}
                    </code>
                    <a
                        href={`https://sepolia.etherscan.io/address/${campaign.creator}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-auto text-xs font-medium text-indigo-300 hover:text-cyan-300"
                    >
                        Xem trên explorer →
                    </a>
                </div>
            </div>

            {/* Beneficiary wallet */}
            {beneficiary && /^0x[a-f0-9]{40}$/i.test(beneficiary) && (
                <div className="mb-6 rounded-xl border border-emerald-400/25 bg-emerald-500/10 p-4">
                    <p className="mb-1 text-sm font-medium text-emerald-300">
                        Ví nhận tiền (Beneficiary)
                    </p>
                    <div className="flex items-center gap-2">
                        <div className="h-7 w-7 flex-shrink-0 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600" />
                        <code className="break-all text-sm font-mono text-slate-200">
                            {beneficiary.slice(0, 8)}...{beneficiary.slice(-6)}
                        </code>
                        <a
                            href={`https://sepolia.etherscan.io/address/${beneficiary}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-auto whitespace-nowrap text-xs font-medium text-emerald-300 hover:text-emerald-200"
                        >
                            Xem ví →
                        </a>
                    </div>
                </div>
            )}

            {/* Reviewer Safe */}
            {reviewerSafe && /^0x[a-f0-9]{40}$/i.test(reviewerSafe) && (
                <div className="mb-6 rounded-xl border border-violet-400/25 bg-violet-500/10 p-4">
                    <p className="mb-1 text-sm font-medium text-violet-300">
                        Reviewer (Gnosis Safe)
                    </p>
                    <div className="flex items-center gap-2">
                        <div className="h-7 w-7 flex-shrink-0 rounded-full bg-gradient-to-br from-violet-400 to-violet-600" />
                        <code className="break-all text-sm font-mono text-slate-200">
                            {reviewerSafe.slice(0, 8)}...{reviewerSafe.slice(-6)}
                        </code>
                        <a
                            href={`https://sepolia.etherscan.io/address/${reviewerSafe}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-auto whitespace-nowrap text-xs font-medium text-violet-300 hover:text-violet-200"
                        >
                            Xem Safe →
                        </a>
                    </div>
                </div>
            )}

            {/* Funding Deadline */}
            {campaign.deadline > 0 && (
                <div className="mb-6 flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-4">
                    <p className="text-sm font-medium text-[var(--text-secondary)]">Hạn gây quỹ</p>
                    <p className="text-sm font-semibold text-[var(--text-primary)]" suppressHydrationWarning>
                        {new Date(campaign.deadline * 1000).toLocaleString("vi-VN")}
                    </p>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="rounded-xl border border-indigo-400/25 bg-indigo-500/10 p-5">
                    <p className="mb-2 text-sm font-medium text-indigo-300">
                        Mục tiêu gây quỹ
                    </p>
                    <p className="text-2xl font-bold text-[var(--text-primary)]">
                        {formatEthAmount(goalEth)}{" "}
                        <span className="text-base font-normal text-[var(--text-secondary)]">
                            ETH
                        </span>
                    </p>
                </div>
                <div className="rounded-xl border border-emerald-400/25 bg-emerald-500/10 p-5">
                    <p className="mb-2 text-sm font-medium text-emerald-300">
                        Tổng đã huy động
                    </p>
                    <p className="text-2xl font-bold text-[var(--text-primary)]">
                        {formatEthAmount(raisedEth)}{" "}
                        <span className="text-base font-normal text-[var(--text-secondary)]">
                            ETH
                        </span>
                    </p>
                </div>
                <div className="rounded-xl border border-amber-400/25 bg-amber-500/10 p-5">
                    <div className="mb-2 flex items-center justify-between">
                        <p className="text-sm font-medium text-amber-300">
                            Hoàn lại nếu thất bại
                        </p>
                        <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-200">
                            {totalRaisedWei > 0n
                                ? `${((Number(remainingWei) * 100) / Number(totalRaisedWei)).toFixed(0)}%`
                                : "100%"}
                        </span>
                    </div>
                    <p className="text-2xl font-bold text-[var(--text-primary)]">
                        {formatEthAmount(Number(formatEther(remainingWei)))}{" "}
                        <span className="text-base font-normal text-[var(--text-secondary)]">
                            ETH
                        </span>
                    </p>
                    {userDonatedWei > 0n && (
                        <div className="mt-3 border-t border-amber-400/20 pt-3">
                            <p className="mb-1 text-[11px] font-medium text-amber-300">Của riêng bạn (dự kiến):</p>
                            <p className="text-sm font-bold text-amber-200">
                                {formatEthAmount(Number(formatEther(userRefundWei)))} ETH
                            </p>
                        </div>
                    )}
                </div>
            </div>

            <div>
                <div className="flex items-center justify-between text-sm mb-2">
                    <span className="font-semibold text-[var(--text-primary)]">
                        Đã đạt {progress.toFixed(1)}%
                    </span>
                    <span className="text-[var(--text-secondary)]">
                        {formatEthAmount(raisedEth)} /{" "}
                        {formatEthAmount(goalEth)} ETH
                    </span>
                </div>
                <div className="h-3 w-full overflow-hidden rounded-full bg-white/10">
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
