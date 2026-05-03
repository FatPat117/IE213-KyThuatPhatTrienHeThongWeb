"use client";

import Link from "next/link";
import { formatEther } from "viem";
import type { PublicCampaignMilestone } from "@/lib/api/campaigns";
import { useReadMilestonesOnChain } from "@/lib/contracts/hooks";

interface MilestoneTimelineProps {
    milestones: PublicCampaignMilestone[];
    campaignId: number;
    contractAddress: string;
    canUploadEvidence: boolean;
    /** Tổng đã huy động — tính mục tiêu thực tế khi campaign đang InProgress */
    raisedWei?: bigint;
    /** Mục tiêu gây quỹ — dùng để tính mục tiêu mốc khi chưa có ai donate */
    goalWei?: bigint;
    userDonatedWei?: bigint;
}

function formatDate(value: Date) {
    return new Intl.DateTimeFormat("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    }).format(value);
}

function formatEthAmount(value: number) {
    if (!Number.isFinite(value) || value <= 0) return "0";
    if (value % 0.01 !== 0) return value.toFixed(4).replace(/\.?0+$/, "");
    return value.toFixed(2);
}

function normalizeIpfsUrl(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith("ipfs://")) {
        const path = trimmed.slice("ipfs://".length);
        return path ? `https://ipfs.io/ipfs/${path}` : null;
    }
    if (/^[A-Za-z0-9]+$/.test(trimmed)) {
        return `https://ipfs.io/ipfs/${trimmed}`;
    }
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return null;
}

function getStatusMeta(status: string) {
    switch (status) {
        case "disbursed":
            return {
                label: "Đã giải ngân chờ xác nhận bằng chứng",
                badgeClass:
                    "bg-emerald-100 text-emerald-700 border-emerald-200",
                dotClass: "bg-emerald-500 ring-emerald-100",
                cardClass: "border-emerald-100",
            };
        case "pending_verification":
            return {
                label: "Chờ xác nhận",
                badgeClass: "bg-blue-100 text-blue-700 border-blue-200",
                dotClass: "bg-blue-500 ring-blue-100",
                cardClass: "border-blue-100",
            };
        case "submitted":
        case "resubmittable":
        case "review_timeout":
        case "approved":
            return {
                label: "Đã hoàn thành",
                badgeClass: "bg-blue-100 text-blue-700 border-blue-200",
                dotClass: "bg-blue-500 ring-blue-100",
                cardClass: "border-blue-100",
            };
        case "deadline_exceeded":
            return {
                label: "Trễ hạn",
                badgeClass: "bg-rose-100 text-rose-700 border-rose-200",
                dotClass: "bg-rose-500 ring-rose-100",
                cardClass: "border-rose-100",
            };
        case "failed":
            return {
                label: "Thất bại",
                badgeClass: "bg-red-100 text-red-700 border-red-200",
                dotClass: "bg-red-500 ring-red-100",
                cardClass: "border-red-100",
            };
        case "refunded":
            return {
                label: "Đã hoàn tiền",
                badgeClass:
                    "bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200",
                dotClass: "bg-fuchsia-500 ring-fuchsia-100",
                cardClass: "border-fuchsia-100",
            };
        default:
            return {
                label: "Sắp tới",
                badgeClass: "bg-slate-100 text-slate-700 border-slate-200",
                dotClass: "bg-slate-400 ring-slate-100",
                cardClass: "border-slate-200",
            };
    }
}

function chainIndexForMilestone(milestoneId: number) {
    // Backend và Contract đều dùng 0-indexed cho ID/Index.
    // Nếu ID nhận được là 0, 1, 2... thì dùng trực tiếp.
    return milestoneId;
}

export default function MilestoneTimeline({
    milestones,
    campaignId,
    contractAddress,
    canUploadEvidence,
    raisedWei = 0n,
    goalWei = 0n,
    userDonatedWei,
}: MilestoneTimelineProps) {
    const { proofCidsByIndex } = useReadMilestonesOnChain(
        campaignId,
        milestones.length,
    );

    return (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-6 flex items-center justify-between gap-3">
                <h2 className="text-2xl font-bold text-slate-900">
                    Dòng thời gian giải ngân
                </h2>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                    Cập nhật theo dữ liệu on-chain hiện tại
                </span>
            </div>

            <div className="relative ml-2 border-l-2 border-slate-200 pl-6">
                {milestones.map((milestone, index) => {
                    const statusMeta = getStatusMeta(milestone.status);
                    const idx = chainIndexForMilestone(milestone.milestoneId);
                    const onChainCids = proofCidsByIndex.get(idx) ?? [];
                    const bps = milestone.allocationBps || 0;
                    // Sử dụng targetWei từ backend, fallback tính toán từ goalWei nếu DB chưa có giá trị
                    let milestoneTargetWei = BigInt(milestone.amountWei || "0");
                    if (milestoneTargetWei === 0n && goalWei > 0n && bps > 0) {
                        milestoneTargetWei = (goalWei * BigInt(bps)) / 10000n;
                    }
                    const milestoneTargetEth = Number(formatEther(milestoneTargetWei));

                    // Số tiền đã thực tế quyên góp được phân bổ cho mốc này
                    const raisedAllocationWei =
                        raisedWei > 0n && bps > 0
                            ? (raisedWei * BigInt(bps)) / 10000n
                            : 0n;
                    const raisedAllocationEth = Number(formatEther(raisedAllocationWei));

                    // Tính tổng % đã giải ngân trước mốc này
                    let accumulatedBps = 0;
                    for (let j = 0; j <= index; j++) {
                        if (milestones[j].status !== "pending_funding") {
                            accumulatedBps += milestones[j].allocationBps || 0;
                        }
                    }
                    const remainingBps = 10000 - accumulatedBps;

                    // Số tiền hoàn lại nếu mốc thất bại = Toàn bộ quỹ còn lại chưa giải ngân
                    const refundWei =
                        raisedWei > 0n
                            ? (raisedWei * BigInt(remainingBps)) / 10000n
                            : 0n;
                    const refundEth = Number(formatEther(refundWei));

                    const allocationPercent = (milestone.allocationBps / 100)
                        .toFixed(2)
                        .replace(/\.00$/, "");
                    const fromDb = milestone.reportCids.map((x) => ({
                        cid: x.cid,
                        submittedAt: x.submittedAt,
                    }));
                    const fromChain = onChainCids.map((cid) => ({
                        cid,
                        submittedAt: "",
                    }));
                    const seen = new Set<string>();
                    const mergedCidList: Array<{
                        cid: string;
                        submittedAt: string;
                    }> = [];
                    for (const row of [...fromDb, ...fromChain]) {
                        const k = row.cid.trim().toLowerCase();
                        if (!k || seen.has(k)) continue;
                        seen.add(k);
                        mergedCidList.push(row);
                    }
                    const ipfsLinks = mergedCidList
                        .map((item) => ({
                            cid: item.cid,
                            url: normalizeIpfsUrl(item.cid),
                        }))
                        .filter((item): item is { cid: string; url: string } =>
                            Boolean(item.url),
                        );

                    return (
                        <article
                            key={milestone.milestoneId}
                            className={`relative mb-6 rounded-xl border bg-gradient-to-b from-white to-slate-50 p-5 shadow-sm last:mb-0 ${statusMeta.cardClass}`}
                        >
                            <span
                                className={`absolute -left-[35px] top-6 h-4 w-4 rounded-full ring-4 ${statusMeta.dotClass}`}
                                aria-hidden
                            />

                            <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                                <div>
                                    <h3 className="text-lg font-bold text-slate-900">
                                        {milestone.title ||
                                            `Mốc #${milestone.milestoneId}`}
                                    </h3>
                                    <p className="mt-1 text-sm text-slate-600">
                                        {milestone.description}
                                    </p>
                                </div>
                                <span
                                    className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusMeta.badgeClass}`}
                                >
                                    {statusMeta.label}
                                </span>
                            </div>

                            <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                                <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                                    <p className="text-xs text-slate-500">
                                        Hạn chót dự kiến
                                    </p>
                                    <p className="font-semibold text-slate-900">
                                        {formatDate(
                                            new Date(milestone.deadline),
                                        )}
                                    </p>
                                </div>
                                <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2">
                                    <p className="text-xs text-blue-600">
                                        Mục tiêu tài chính mốc
                                    </p>
                                    <p className="font-semibold text-blue-900">
                                        {formatEthAmount(milestoneTargetEth)}{" "}
                                        ETH ({allocationPercent}%)
                                    </p>
                                </div>
                                <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2">
                                    <p className="text-xs text-emerald-600">
                                        Đã quyên góp cho mốc
                                    </p>
                                    <p className="font-semibold text-emerald-900">
                                        {raisedWei > 0n
                                            ? `${formatEthAmount(raisedAllocationEth)} ETH`
                                            : "Chưa có"}
                                    </p>
                                </div>
                                <div className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2">
                                    <p className="text-xs text-amber-600">
                                        Hoàn lại nếu thất bại
                                    </p>
                                    <p className="font-semibold text-amber-900">
                                        {raisedWei > 0n
                                            ? `${formatEthAmount(refundEth)} ETH`
                                            : "Chưa xác định"}
                                    </p>
                                    {userDonatedWei && userDonatedWei > 0n && raisedWei && raisedWei > 0n && (
                                        <div className="mt-1 pt-1 border-t border-amber-200">
                                            <p className="text-[10px] text-amber-700">Của bạn: {formatEthAmount(Number(formatEther((userDonatedWei * milestoneTargetWei) / goalWei || 0n)))} ETH</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {milestone.status === "resubmittable" && (
                                <div className="mt-4 rounded-xl border border-orange-200 bg-orange-50 p-4 shadow-sm animate-pulse">
                                    <div className="flex items-center gap-2 mb-2 text-orange-800">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                        </svg>
                                        <span className="font-bold">Cần nộp lại minh chứng</span>
                                    </div>
                                    <p className="text-sm text-orange-700 leading-relaxed mb-3">
                                        <strong>Lý do từ chối:</strong> {milestone.lastRejectionReason || "Reviewer yêu cầu bổ sung thông tin."}
                                    </p>
                                    {canUploadEvidence && (
                                        <Link
                                            href={`/campaigns/${campaignId}/milestones/upload?milestone=${milestone.milestoneId}`}
                                            className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-xs font-bold text-white hover:bg-orange-700 transition shadow-md shadow-orange-200"
                                        >
                                            Cập nhật báo cáo ngay →
                                        </Link>
                                    )}
                                </div>
                            )}

                            <div className="mt-4 rounded-lg border border-slate-200 bg-white p-3">
                                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Đường dẫn bằng chứng
                                </p>
                                <div className="flex flex-wrap items-center gap-2 text-sm">
                                    {canUploadEvidence ? (
                                        <Link
                                            href={`/campaigns/${campaignId}/milestones/upload?milestone=${milestone.milestoneId}`}
                                            className="inline-flex items-center rounded-md border border-blue-200 bg-blue-50 px-3 py-1.5 font-semibold text-blue-700 hover:bg-blue-100"
                                        >
                                            Upload minh chứng
                                        </Link>
                                    ) : (
                                        <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-100 px-3 py-1.5 font-semibold text-slate-500">
                                            Chỉ creator được upload
                                        </span>
                                    )}
                                    <a
                                        href={`https://sepolia.etherscan.io/address/${contractAddress}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center rounded-md border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50"
                                    >
                                        Xem smart contract
                                    </a>
                                    {ipfsLinks.map((item) => (
                                        <div key={`${milestone.milestoneId}-${item.cid}`} className="flex items-center gap-2">
                                            <a
                                                href={item.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 font-medium text-emerald-700 hover:bg-emerald-100 transition-colors"
                                            >
                                                <svg className="mr-1.5 h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                </svg>
                                                IPFS: {item.cid.slice(0, 8)}...{item.cid.slice(-4)}
                                            </a>
                                            {canUploadEvidence && (
                                                <Link
                                                    href={`/campaigns/${campaignId}/milestones/upload?milestone=${milestone.milestoneId}&sourceCid=${encodeURIComponent(item.cid)}`}
                                                    className="text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline"
                                                >
                                                    Cập nhật báo cáo
                                                </Link>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </article>
                    );
                })}
            </div>
        </section>
    );
}
