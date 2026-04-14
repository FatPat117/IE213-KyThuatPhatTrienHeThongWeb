"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { formatEther } from "viem";
import {
    getPublicCampaigns,
    type PublicCampaignItem,
    usePublicStats,
} from "@/lib";

function formatEthFromWei(wei: string): string {
    try {
        const eth = Number(formatEther(BigInt(wei || "0")));
        return eth.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 4,
        });
    } catch {
        return "0.00";
    }
}

function formatDate(value?: string): string {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleString("en-US", {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    });
}

function statusBadgeClass(status: string): string {
    switch (status) {
        case "active":
            return "border-emerald-200 bg-emerald-50 text-emerald-700";
        case "in_progress":
            return "border-blue-200 bg-blue-50 text-blue-700";
        case "completed":
            return "border-teal-200 bg-teal-50 text-teal-700";
        case "partial_failed":
            return "border-amber-200 bg-amber-50 text-amber-700";
        case "failed":
            return "border-rose-200 bg-rose-50 text-rose-700";
        case "cancelled":
            return "border-slate-300 bg-slate-100 text-slate-700";
        default:
            return "border-slate-200 bg-slate-50 text-slate-700";
    }
}

function statusLabel(status: string): string {
    switch (status) {
        case "active":
            return "Active";
        case "in_progress":
            return "In Progress";
        case "completed":
            return "Completed";
        case "partial_failed":
            return "Partially Failed";
        case "failed":
            return "Failed";
        case "cancelled":
            return "Cancelled";
        default:
            return status || "Unknown";
    }
}

export default function TransparencyPage() {
    const statsQuery = usePublicStats();
    const [campaigns, setCampaigns] = useState<PublicCampaignItem[]>([]);
    const [campaignsLoading, setCampaignsLoading] = useState(true);
    const [campaignsError, setCampaignsError] = useState<string | null>(null);

    useEffect(() => {
        let alive = true;

        const load = async () => {
            try {
                setCampaignsLoading(true);
                setCampaignsError(null);
                const response = await getPublicCampaigns({
                    page: 1,
                    limit: 12,
                    sort: "updatedAt",
                    order: "desc",
                });

                if (!alive) return;
                setCampaigns(response.items || []);
            } catch (error) {
                if (!alive) return;
                setCampaignsError(
                    error instanceof Error
                        ? error.message
                        : "Unable to load public campaigns",
                );
            } finally {
                if (!alive) return;
                setCampaignsLoading(false);
            }
        };

        load();
        return () => {
            alive = false;
        };
    }, []);

    const stats = statsQuery.data;

    const statusCards = useMemo(
        () => [
            {
                key: "active",
                label: "Active",
                count: stats?.activeCampaigns ?? 0,
            },
            {
                key: "in_progress",
                label: "In Progress",
                count: stats?.inProgressCampaigns ?? 0,
            },
            {
                key: "completed",
                label: "Completed",
                count: stats?.completedCampaigns ?? 0,
            },
            {
                key: "partial_failed",
                label: "Partially Failed",
                count: stats?.partialFailedCampaigns ?? 0,
            },
            {
                key: "failed",
                label: "Failed",
                count: stats?.failedCampaigns ?? 0,
            },
        ],
        [stats],
    );

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white text-slate-900">
            <main className="mx-auto w-full max-w-6xl space-y-8 px-6 py-12 md:px-10">
                <header className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
                    <p className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-indigo-700">
                        Public Transparency
                    </p>
                    <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
                        Funding Flow Transparency Board
                    </h1>
                    <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600 md:text-base">
                        This page aggregates publicly indexed campaign data so
                        donors can quickly verify funding activity, disbursement
                        progress, and campaign outcomes.
                    </p>
                    <p className="mt-3 text-xs font-medium text-slate-500">
                        Last refreshed: {formatDate(stats?.updatedAt)}
                    </p>
                    <div className="mt-6 flex flex-wrap gap-3">
                        <Link
                            href="/campaigns"
                            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-blue-300 hover:text-blue-700"
                        >
                            Browse Campaigns
                        </Link>
                        <Link
                            href="/leaderboard"
                            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-blue-300 hover:text-blue-700"
                        >
                            View Leaderboard
                        </Link>
                    </div>
                </header>

                {statsQuery.error && (
                    <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                        {statsQuery.error}
                    </div>
                )}

                <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Total Campaigns
                        </p>
                        <p className="mt-2 text-3xl font-bold text-slate-900">
                            {stats?.totalCampaigns ?? 0}
                        </p>
                    </article>
                    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Total Raised
                        </p>
                        <p className="mt-2 text-3xl font-bold text-slate-900">
                            {formatEthFromWei(stats?.totalRaisedWei || "0")} ETH
                        </p>
                    </article>
                    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Total Disbursed
                        </p>
                        <p className="mt-2 text-3xl font-bold text-slate-900">
                            {formatEthFromWei(stats?.totalDisbursedWei || "0")}{" "}
                            ETH
                        </p>
                    </article>
                    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Unique Donors
                        </p>
                        <p className="mt-2 text-3xl font-bold text-slate-900">
                            {stats?.uniqueDonors ?? 0}
                        </p>
                    </article>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <h2 className="text-lg font-bold text-slate-900">
                        Campaign Status Breakdown
                    </h2>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                        {statusCards.map((item) => (
                            <div
                                key={item.key}
                                className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
                            >
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    {item.label}
                                </p>
                                <p className="mt-1 text-2xl font-bold text-slate-900">
                                    {item.count}
                                </p>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                            <h2 className="text-lg font-bold text-slate-900">
                                Latest Public Campaign Snapshots
                            </h2>
                            <p className="mt-1 text-sm text-slate-600">
                                Sorted by latest indexed update from
                                campaign-service.
                            </p>
                        </div>
                    </div>

                    {(statsQuery.isLoading || campaignsLoading) && (
                        <div className="mt-4 space-y-3 animate-pulse">
                            <div className="h-16 rounded-xl bg-slate-100" />
                            <div className="h-16 rounded-xl bg-slate-100" />
                            <div className="h-16 rounded-xl bg-slate-100" />
                        </div>
                    )}

                    {campaignsError && (
                        <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                            {campaignsError}
                        </p>
                    )}

                    {!statsQuery.isLoading &&
                        !campaignsLoading &&
                        !campaignsError &&
                        campaigns.length === 0 && (
                            <p className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-600">
                                No campaigns are indexed yet.
                            </p>
                        )}

                    {!statsQuery.isLoading &&
                        !campaignsLoading &&
                        campaigns.length > 0 && (
                            <div className="mt-4 overflow-x-auto">
                                <table className="min-w-full border-collapse text-sm">
                                    <thead>
                                        <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                                            <th className="px-3 py-2 font-semibold">
                                                Campaign
                                            </th>
                                            <th className="px-3 py-2 font-semibold">
                                                Status
                                            </th>
                                            <th className="px-3 py-2 font-semibold">
                                                Raised
                                            </th>
                                            <th className="px-3 py-2 font-semibold">
                                                Disbursed
                                            </th>
                                            <th className="px-3 py-2 font-semibold">
                                                Deadline
                                            </th>
                                            <th className="px-3 py-2 font-semibold">
                                                Details
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {campaigns.map((campaign) => (
                                            <tr
                                                key={campaign.onChainId}
                                                className="border-b border-slate-100 align-top last:border-b-0"
                                            >
                                                <td className="px-3 py-3">
                                                    <p className="font-semibold text-slate-900">
                                                        {campaign.title ||
                                                            `Campaign #${campaign.onChainId}`}
                                                    </p>
                                                    <p className="mt-1 text-xs text-slate-500">
                                                        ID #{campaign.onChainId}
                                                    </p>
                                                </td>
                                                <td className="px-3 py-3">
                                                    <span
                                                        className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusBadgeClass(campaign.status)}`}
                                                    >
                                                        {statusLabel(
                                                            campaign.status,
                                                        )}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-3 font-medium text-slate-800">
                                                    {formatEthFromWei(
                                                        campaign.totalRaisedWei,
                                                    )}{" "}
                                                    ETH
                                                </td>
                                                <td className="px-3 py-3 font-medium text-slate-800">
                                                    {formatEthFromWei(
                                                        campaign.totalDisbursedWei,
                                                    )}{" "}
                                                    ETH
                                                </td>
                                                <td className="px-3 py-3 text-slate-600">
                                                    {formatDate(
                                                        campaign.deadline,
                                                    )}
                                                </td>
                                                <td className="px-3 py-3">
                                                    <Link
                                                        href={`/campaigns/${campaign.onChainId}`}
                                                        className="text-xs font-semibold text-blue-600 hover:text-blue-700"
                                                    >
                                                        Open Campaign →
                                                    </Link>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                </section>
            </main>
        </div>
    );
}
