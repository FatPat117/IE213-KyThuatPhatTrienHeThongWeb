"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { formatEther } from "viem";
import {
    getCampaignMetadataFromCache,
    isPlaceholderCampaignTitle,
    useBackendCampaign,
    useAuth,
    useReadCampaign,
} from "@/lib";
import {
    getPublicCampaignMilestones,
    type PublicCampaignMilestone,
} from "@/lib/api/campaigns";
import { contractConfig } from "@/lib/contracts/config";
import { buildTimelineMilestones } from "@/lib/utils/milestone-plan";
import {
    MilestoneOverviewCard,
    MilestoneTimeline,
} from "@/components/campaign-milestones";
import BackButton from "@/components/navigation/BackButton";
import { useAccount } from "wagmi";

export default function CampaignMilestonesPage() {
    const params = useParams();
    const id = Number(params?.id);
    const { address } = useAccount();
    const { token } = useAuth();

    const { campaign, isLoading, isError, error, refetch } = useReadCampaign(
        Number.isFinite(id) ? id : null,
    );
    const backendCampaign = useBackendCampaign(Number.isFinite(id) ? id : null);
    const [milestones, setMilestones] = useState<PublicCampaignMilestone[]>([]);
    const [isMilestonesLoading, setIsMilestonesLoading] = useState(false);
    const [milestonesError, setMilestonesError] = useState<string | null>(null);
    const [milestonesWarning, setMilestonesWarning] = useState<string | null>(
        null,
    );

    const progress = useMemo(() => {
        if (!campaign) return 0;
        const goalEth = Number(formatEther(campaign.goal));
        const raisedEth = Number(formatEther(campaign.raised));
        return goalEth > 0 ? Math.min((raisedEth / goalEth) * 100, 100) : 0;
    }, [campaign]);

    const loadMilestones = useCallback(async () => {
        if (!Number.isFinite(id)) return;

        try {
            setIsMilestonesLoading(true);
            setMilestonesError(null);
            setMilestonesWarning(null);
            const data = await getPublicCampaignMilestones(id);
            setMilestones(data.milestones || []);
        } catch (err) {
            const message =
                err instanceof Error
                    ? err.message
                    : "Không thể tải milestones từ API";
            // Keep page usable even when campaign-service indexing lags behind on-chain data.
            if (
                message.toLowerCase().includes("campaign not found") ||
                message.toLowerCase().includes("not yet indexed") ||
                message.toLowerCase().includes("chưa được index")
            ) {
                setMilestones([]);
                setMilestonesWarning(
                    "Campaign chưa được index đầy đủ ở backend, đang hiển thị timeline dựa trên dữ liệu on-chain.",
                );
                return;
            }

            setMilestonesError(message);
        } finally {
            setIsMilestonesLoading(false);
        }
    }, [id]);

    useEffect(() => {
        loadMilestones();
    }, [loadMilestones]);

    useEffect(() => {
        if (!Number.isFinite(id)) return;
        if (!milestonesWarning) return;

        // Backend indexing can finish a few seconds after campaign creation.
        // Auto-retry to replace fallback timeline with indexed milestones.
        const retryTimer = window.setInterval(() => {
            refetch();
            loadMilestones();
        }, 5000);

        return () => {
            window.clearInterval(retryTimer);
        };
    }, [id, loadMilestones, milestonesWarning, refetch]);

    const cachedMetadata = useMemo(
        () => (Number.isFinite(id) ? getCampaignMetadataFromCache(id) : null),
        [id],
    );
    const title = !isPlaceholderCampaignTitle(backendCampaign.data?.title, id)
        ? backendCampaign.data?.title
        : cachedMetadata?.title ||
          campaign?.title ||
          `Campaign #${Number.isFinite(id) ? id : "-"}`;

    const fallbackMilestones = useMemo<PublicCampaignMilestone[]>(() => {
        if (!campaign) return [];

        const timelineStatusLabel =
            campaign.statusLabel === "pending_approval"
                ? "active"
                : campaign.statusLabel;

        return buildTimelineMilestones({
            campaignId: campaign.id,
            campaignDeadline: campaign.deadline,
            campaignCreatedAt: backendCampaign.data?.createdAt,
            progressPercent: progress,
            goalWei: campaign.goal,
            totalRaisedWei: campaign.raised,
            milestoneCount: campaign.milestoneCount,
            campaignStatusLabel: timelineStatusLabel,
            currentMilestoneId: campaign.currentMilestoneId,
        }).map((item, index) => {
            const mappedStatus: PublicCampaignMilestone["status"] =
                item.status === "completed"
                    ? "disbursed"
                    : item.status === "in_progress"
                      ? "pending_verification"
                      : item.status === "delayed"
                        ? "deadline_exceeded"
                        : item.status === "failed"
                          ? "failed"
                          : "pending_funding";

            return {
                milestoneId: index + 1,
                title: item.title,
                description: item.description,
                allocationBps: Math.round(item.allocationPercent * 100),
                amountWei: item.targetAmountWei.toString(),
                deadline: item.expectedDate.toISOString(),
                status: mappedStatus,
                reportCids: [],
                approvedAt: null,
                approvedBy: "",
                disbursedAt: null,
            };
        });
    }, [backendCampaign.data?.createdAt, campaign, progress]);

    const milestonesToRender =
        milestones.length > 0 ? milestones : fallbackMilestones;
    const canUploadEvidence =
        Boolean(token) &&
        Boolean(address) &&
        Boolean(campaign?.creator) &&
        campaign?.creator.toLowerCase() === address?.toLowerCase();

    console.log("Milestones to render:", milestonesToRender);
    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white text-slate-900">
            <main className="mx-auto w-full max-w-6xl px-6 py-12 md:px-10">
                <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <BackButton
                            fallbackHref={
                                Number.isFinite(id)
                                    ? `/campaigns/${id}`
                                    : "/campaigns"
                            }
                            preferFallback
                        />
                        <div>
                            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-blue-600">
                                Milestones Timeline
                            </p>
                            <h1 className="text-3xl font-bold text-slate-900">
                                Mốc giải ngân chiến dịch
                            </h1>
                            <p className="mt-1 text-sm text-slate-600">
                                {title}
                            </p>
                        </div>
                    </div>
                    {Number.isFinite(id) && (
                        <Link
                            href={`/campaigns/${id}`}
                            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-blue-300 hover:text-blue-700"
                        >
                            Quay lại trang chiến dịch
                        </Link>
                    )}
                </header>

                {(isLoading ||
                    backendCampaign.isLoading ||
                    isMilestonesLoading) && (
                    <div className="space-y-4 animate-pulse">
                        <div className="h-24 rounded-2xl bg-slate-200" />
                        <div className="h-40 rounded-2xl bg-slate-200" />
                        <div className="h-40 rounded-2xl bg-slate-200" />
                    </div>
                )}

                {!isLoading && (isError || milestonesError) && (
                    <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
                        <p className="text-lg font-semibold text-red-900">
                            Không thể tải timeline mốc
                        </p>
                        <p className="mt-2 text-sm text-red-700">
                            {error || milestonesError || "Có lỗi xảy ra."}
                        </p>
                        <button
                            onClick={() => {
                                refetch();
                                loadMilestones();
                            }}
                            className="mt-4 rounded-lg bg-red-600 px-5 py-2 text-sm font-semibold text-white hover:bg-red-700"
                        >
                            Tải lại
                        </button>
                    </div>
                )}

                {!isLoading &&
                    !backendCampaign.isLoading &&
                    !isMilestonesLoading &&
                    !isError &&
                    !milestonesError &&
                    campaign && (
                        <div className="space-y-6">
                            {milestonesWarning && (
                                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                                    {milestonesWarning}
                                </div>
                            )}
                            <MilestoneOverviewCard
                                progressPercent={progress}
                                milestones={milestonesToRender}
                                goalWei={campaign.goal}
                                raisedWei={campaign.raised}
                            />

                            <MilestoneTimeline
                                milestones={milestonesToRender}
                                campaignId={campaign.id}
                                contractAddress={contractConfig.address}
                                canUploadEvidence={canUploadEvidence}
                                raisedWei={campaign.raised}
                            />
                        </div>
                    )}
            </main>
        </div>
    );
}
