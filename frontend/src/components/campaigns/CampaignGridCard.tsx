"use client";

import Link from "next/link";
import { formatEther } from "viem";
import {
    formatEthAmount,
    getCampaignStatusPresentation,
    resolveCampaignThumbnail,
    shortenWalletAddress,
    type CampaignListRowData,
} from "@/lib/utils/campaign-display";

function GridThumbnail({
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
                className="h-full w-full rounded-t-[12px] object-cover"
                loading="lazy"
            />
        );
    }

    return (
        <div className="flex h-full w-full flex-col items-center justify-center rounded-t-[12px] bg-gradient-to-br from-indigo-600/80 via-indigo-700/90 to-cyan-700/80 text-white">
            <span className="text-[10px] font-semibold uppercase tracking-wider opacity-90">
                Chiến dịch
            </span>
            <span className="font-display text-2xl font-bold">#{campaignId}</span>
        </div>
    );
}

type CampaignGridCardProps = {
    campaign: CampaignListRowData;
    href?: string;
};

export default function CampaignGridCard({
    campaign,
    href,
}: CampaignGridCardProps) {
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

    return (
        <Link
            href={targetHref}
            className="campaigns-grid-card group flex h-full flex-col overflow-hidden"
        >
            <div className="relative aspect-video w-full shrink-0 overflow-hidden bg-[rgba(99,102,241,0.08)]">
                <GridThumbnail
                    campaignId={campaign.id}
                    title={campaign.title}
                    thumbnailUrl={thumbnailUrl}
                />
                <span
                    className={`absolute right-3 top-3 rounded-full border px-2.5 py-1 text-[11px] font-semibold backdrop-blur-sm ${status.badgeClass}`}
                >
                    {status.label}
                </span>
            </div>

            <div className="flex flex-1 flex-col gap-3 p-4">
                <p className="font-mono-data text-[11px] text-[var(--text-secondary)]">
                    #{campaign.id} · {shortenWalletAddress(campaign.creator)}
                </p>

                <h3 className="font-display line-clamp-2 text-lg font-bold leading-snug text-[var(--text-primary)] transition group-hover:text-[var(--accent-cyan)]">
                    {campaign.title}
                </h3>

                <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex min-w-0 items-center gap-1.5">
                        <span className="shrink-0 text-[var(--text-secondary)]" aria-hidden>
                            👤
                        </span>
                        <span
                            className="font-mono-data truncate text-[var(--accent-cyan)]"
                            title={campaign.creator}
                        >
                            {shortenWalletAddress(campaign.creator)}
                        </span>
                    </div>
                    <div className="flex min-w-0 items-center gap-1.5">
                        <span className="shrink-0 text-[var(--text-secondary)]" aria-hidden>
                            🔍
                        </span>
                        <span
                            className="font-mono-data truncate text-[var(--accent-cyan)]"
                            title={campaign.reviewerSafe || ""}
                        >
                            {shortenWalletAddress(campaign.reviewerSafe)}
                        </span>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                    <div>
                        <p className="text-[var(--text-secondary)]">Mục tiêu</p>
                        <p className="font-mono-data font-semibold text-[var(--accent-cyan)]">
                            {formatEthAmount(goalEth)} ETH
                        </p>
                    </div>
                    <div>
                        <p className="text-[var(--text-secondary)]">Đã gây quỹ</p>
                        <p className="font-mono-data font-semibold text-[var(--accent-cyan)]">
                            {formatEthAmount(raisedEth)} ETH
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <div className="campaign-progress-track h-2 min-w-0 flex-1 overflow-hidden rounded-full">
                        <div
                            className="campaign-progress-fill h-full min-w-[4px] rounded-full"
                            style={{
                                width:
                                    progress > 0 ? `${progress}%` : "4px",
                            }}
                        />
                    </div>
                    <span className="campaign-progress-pct shrink-0 font-mono-data text-xs font-semibold">
                        {progress.toFixed(1)}%
                    </span>
                </div>
                <p className="font-mono-data text-[11px] text-[var(--text-secondary)]">
                    {formatEthAmount(raisedEth)} / {formatEthAmount(goalEth)} ETH
                </p>

                <span className="btn-view-detail mt-auto flex w-full items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold">
                    Xem chi tiết →
                </span>
            </div>
        </Link>
    );
}

export function CampaignGridCardSkeleton() {
    return (
        <div className="campaigns-grid-card flex animate-pulse flex-col overflow-hidden">
            <div className="aspect-video w-full rounded-t-[12px] bg-[rgba(99,102,241,0.12)]" />
            <div className="flex flex-col gap-3 p-4">
                <div className="h-3 w-2/5 rounded bg-[rgba(255,255,255,0.08)]" />
                <div className="h-5 w-4/5 rounded bg-[rgba(255,255,255,0.1)]" />
                <div className="grid grid-cols-2 gap-2">
                    <div className="h-4 rounded bg-[rgba(255,255,255,0.06)]" />
                    <div className="h-4 rounded bg-[rgba(255,255,255,0.06)]" />
                </div>
                <div className="h-2 w-full rounded-full bg-[rgba(255,255,255,0.08)]" />
                <div className="h-10 w-full rounded-lg bg-[rgba(255,255,255,0.08)]" />
            </div>
        </div>
    );
}
