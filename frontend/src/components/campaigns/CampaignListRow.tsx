"use client";

import Link from "next/link";
import { useState } from "react";
import { formatEther } from "viem";
import {
    BTN_GHOST,
    formatCampaignDateTime,
    formatEthAmount,
    getCampaignStatusPresentation,
    resolveCampaignThumbnail,
    shortenWalletAddress,
    type CampaignListRowData,
} from "@/lib/utils/campaign-display";
import {
    CAMPAIGN_DESCRIPTION_SECTIONS,
    parseCampaignDescription,
} from "@/lib/utils/campaign-description-fields";

export type { CampaignListRowData };

type CampaignListRowProps = {
    campaign: CampaignListRowData;
    href?: string;
    footerSlot?: React.ReactNode;
    className?: string;
};

function CampaignThumbnail({
    campaignId,
    title,
    thumbnailUrl,
}: {
    campaignId: number;
    title: string;
    thumbnailUrl: string | null;
}) {
    if (thumbnailUrl) {
        return (
            // eslint-disable-next-line @next/next/no-img-element
            <img
                src={thumbnailUrl}
                alt={title}
                className="h-full w-full object-cover"
                loading="lazy"
            />
        );
    }

    return (
        <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-indigo-600/80 via-indigo-700/90 to-cyan-700/80 px-2 text-center text-white">
            <span className="text-[10px] font-semibold uppercase tracking-wider opacity-90">
                Chiến dịch
            </span>
            <span className="font-display text-2xl font-bold">#{campaignId}</span>
        </div>
    );
}

function getFirstDescriptionLine(description: string): string {
    const trimmed = (description || "").trim();
    if (!trimmed) return "Chưa có mô tả chi tiết.";

    const parts = parseCampaignDescription(trimmed);
    for (const section of CAMPAIGN_DESCRIPTION_SECTIONS) {
        const value = (parts[section.key] || "").trim();
        if (value) {
            return value.replace(/\s+/g, " ");
        }
    }
    return trimmed.replace(/\s+/g, " ");
}

function CollapsibleCampaignDescription({
    description,
}: {
    description: string;
}) {
    const [expanded, setExpanded] = useState(false);
    const parts = parseCampaignDescription(description);
    const sections = CAMPAIGN_DESCRIPTION_SECTIONS.filter((section) =>
        (parts[section.key] || "").trim(),
    );
    const firstLine = getFirstDescriptionLine(description);

    return (
        <div className="mt-3">
            {!expanded ? (
                <p className="truncate text-sm text-[var(--text-secondary)]" title={firstLine}>
                    {firstLine}
                </p>
            ) : sections.length > 0 ? (
                <div className="space-y-2">
                    {sections.map((section) => (
                        <div
                            key={section.key}
                            className="campaign-desc-info-block rounded-lg px-3 py-2"
                        >
                            <p className="campaign-desc-info-label text-[11px] font-semibold uppercase tracking-[0.1em]">
                                {section.label}
                            </p>
                            <p className="campaign-desc-info-value mt-1 whitespace-pre-wrap text-sm leading-relaxed">
                                {parts[section.key]}
                            </p>
                        </div>
                    ))}
                </div>
            ) : (
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--text-secondary)]">
                    {description || "Chưa có mô tả chi tiết."}
                </p>
            )}
            <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="mt-2 text-xs font-semibold text-[var(--accent-cyan)] transition hover:text-[var(--accent-primary)]"
            >
                {expanded ? "▲ Thu gọn" : "▼ Xem mô tả"}
            </button>
        </div>
    );
}

function MetaItem({ label, value }: { label: string; value: string }) {
    return (
        <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-secondary)]">
                {label}
            </p>
            <p
                className="mt-0.5 truncate font-mono-data text-sm font-semibold text-[var(--accent-cyan)]"
                title={value}
            >
                {value}
            </p>
        </div>
    );
}

export default function CampaignListRow({
    campaign,
    href,
    footerSlot,
    className = "",
}: CampaignListRowProps) {
    const goalEth = Number(formatEther(campaign.goal));
    const raisedEth = Number(formatEther(campaign.raised));
    const progress =
        goalEth > 0 ? Math.min((raisedEth / goalEth) * 100, 100) : 0;
    const status = getCampaignStatusPresentation(
        campaign.status,
        campaign.completed,
    );
    const thumbnailUrl = resolveCampaignThumbnail(
        campaign.id,
        campaign.thumbnailUrl,
    );
    const targetHref = href ?? `/campaigns/${campaign.id}`;
    const rowClassName = `campaign-list-row group flex flex-col gap-4 rounded-2xl border border-slate-200 border-l-[3px] border-l-[var(--accent-primary)] bg-white p-4 shadow-sm transition-all duration-200 sm:flex-row sm:items-stretch sm:p-5 ${className}`;

    const body = (
        <>
            <Link
                href={targetHref}
                className="relative h-[180px] w-full shrink-0 overflow-hidden rounded-xl bg-slate-100 sm:h-[180px] sm:min-h-0 sm:w-[200px] sm:min-w-[200px]"
            >
                <CampaignThumbnail
                    campaignId={campaign.id}
                    title={campaign.title}
                    thumbnailUrl={thumbnailUrl}
                />
            </Link>

            <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                        <Link href={targetHref}>
                            <h3 className="font-display text-lg font-bold leading-snug text-slate-900 transition hover:text-[var(--accent-cyan)] sm:text-xl">
                                {campaign.title}
                            </h3>
                        </Link>
                        <p className="mt-1 font-mono-data text-xs text-[var(--text-secondary)]">
                            Mã chiến dịch #{campaign.id}
                        </p>
                    </div>
                    <span
                        className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold ${status.badgeClass}`}
                    >
                        {status.label}
                    </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl border border-slate-100 bg-slate-50/80 p-4 sm:grid-cols-3 lg:grid-cols-4">
                    <MetaItem
                        label="Người tạo"
                        value={shortenWalletAddress(campaign.creator)}
                    />
                    <MetaItem
                        label="Ví nhận tiền"
                        value={shortenWalletAddress(campaign.beneficiary)}
                    />
                    <MetaItem
                        label="Kiểm duyệt"
                        value={shortenWalletAddress(campaign.reviewerSafe)}
                    />
                    <MetaItem
                        label="Thời hạn"
                        value={formatCampaignDateTime(campaign.deadline)}
                    />
                    <MetaItem
                        label="Số mốc"
                        value={
                            campaign.milestoneCount != null
                                ? String(campaign.milestoneCount)
                                : "—"
                        }
                    />
                    <MetaItem
                        label="Ngày tạo"
                        value={formatCampaignDateTime(campaign.createdAt)}
                    />
                    <MetaItem
                        label="Mục tiêu"
                        value={`${formatEthAmount(goalEth)} ETH`}
                    />
                    <MetaItem
                        label="Đã gây quỹ"
                        value={`${formatEthAmount(raisedEth)} ETH`}
                    />
                </div>

                <CollapsibleCampaignDescription description={campaign.description} />

                <div className="mt-4">
                    <div className="mb-2 flex items-center justify-between gap-2 text-xs font-medium text-slate-600">
                        <span>Tiến độ gây quỹ</span>
                        <span className="campaign-progress-summary text-right">
                            <span className="campaign-progress-pct font-semibold">
                                {progress.toFixed(1)}%
                            </span>
                            <span className="campaign-progress-amount">
                                {" "}
                                · {formatEthAmount(raisedEth)} /{" "}
                                {formatEthAmount(goalEth)} ETH
                            </span>
                        </span>
                    </div>
                    <div className="campaign-progress-track h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
                        <div
                            className="campaign-progress-fill h-full min-w-[4px] rounded-full transition-all duration-500"
                            style={{
                                width:
                                    progress > 0 ? `${progress}%` : "4px",
                            }}
                        />
                    </div>
                </div>

                {footerSlot ? (
                    <div className="mt-4 flex justify-end">{footerSlot}</div>
                ) : (
                    <div className="mt-4 flex justify-end">
                        <Link href={targetHref} className={BTN_GHOST}>
                            Xem chi tiết →
                        </Link>
                    </div>
                )}
            </div>
        </>
    );

    return <article className={rowClassName}>{body}</article>;
}

export function CampaignListRowSkeleton() {
    return (
        <div className="campaign-list-row flex animate-pulse flex-col gap-4 rounded-2xl border border-l-[3px] border-l-[var(--accent-primary)] border-slate-200 bg-white p-4 sm:flex-row sm:p-5">
            <div className="loading-skeleton h-[180px] w-full shrink-0 rounded-xl sm:w-[200px] sm:min-w-[200px]" />
            <div className="flex flex-1 flex-col gap-3">
                <div className="loading-skeleton h-6 w-2/3 rounded" />
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="loading-skeleton-muted h-10 rounded" />
                    ))}
                </div>
                <div className="loading-skeleton-muted h-4 w-full rounded" />
                <div className="loading-skeleton h-2.5 w-full rounded-full" />
                <div className="loading-skeleton ml-auto h-10 w-36 rounded-lg" />
            </div>
        </div>
    );
}
