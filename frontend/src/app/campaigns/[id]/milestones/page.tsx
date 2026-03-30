'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import { formatEther } from 'viem';
import {
  isPlaceholderCampaignTitle,
  useBackendCampaign,
  useReadCampaign,
} from '@/lib';
import { contractConfig } from '@/lib/contracts/config';
import { buildTimelineMilestones } from '@/lib/utils/milestone-plan';
import { MilestoneOverviewCard, MilestoneTimeline } from '@/components/campaign-milestones';
import BackButton from '@/components/navigation/BackButton';

export default function CampaignMilestonesPage() {
  const params = useParams();
  const id = Number(params?.id);

  const { campaign, isLoading, isError, error, refetch } = useReadCampaign(
    Number.isFinite(id) ? id : null,
  );
  const backendCampaign = useBackendCampaign(Number.isFinite(id) ? id : null);

  const progress = useMemo(() => {
    if (!campaign) return 0;
    const goalEth = Number(formatEther(campaign.goal));
    const raisedEth = Number(formatEther(campaign.raised));
    return goalEth > 0 ? Math.min((raisedEth / goalEth) * 100, 100) : 0;
  }, [campaign]);

  const milestones = useMemo(() => {
    if (!campaign) return [];
    return buildTimelineMilestones({
      campaignId: campaign.id,
      campaignDeadline: campaign.deadline,
      campaignCreatedAt: backendCampaign.data?.createdAt,
      progressPercent: progress,
      goalWei: campaign.goal,
    });
  }, [backendCampaign.data?.createdAt, campaign, progress]);

  const title = !isPlaceholderCampaignTitle(backendCampaign.data?.title, id)
    ? backendCampaign.data?.title
    : campaign?.title || `Campaign #${Number.isFinite(id) ? id : '-'}`;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white text-slate-900">
      <main className="mx-auto w-full max-w-6xl px-6 py-12 md:px-10">
        <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <BackButton fallbackHref={Number.isFinite(id) ? `/campaigns/${id}` : '/campaigns'} preferFallback />
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-blue-600">
                Milestones Timeline
              </p>
              <h1 className="text-3xl font-bold text-slate-900">Mốc giải ngân chiến dịch</h1>
              <p className="mt-1 text-sm text-slate-600">{title}</p>
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

        {(isLoading || backendCampaign.isLoading) && (
          <div className="space-y-4 animate-pulse">
            <div className="h-24 rounded-2xl bg-slate-200" />
            <div className="h-40 rounded-2xl bg-slate-200" />
            <div className="h-40 rounded-2xl bg-slate-200" />
          </div>
        )}

        {!isLoading && isError && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
            <p className="text-lg font-semibold text-red-900">Không thể tải timeline mốc</p>
            <p className="mt-2 text-sm text-red-700">{error || 'Có lỗi xảy ra.'}</p>
            <button
              onClick={() => refetch()}
              className="mt-4 rounded-lg bg-red-600 px-5 py-2 text-sm font-semibold text-white hover:bg-red-700"
            >
              Tải lại
            </button>
          </div>
        )}

        {!isLoading && !backendCampaign.isLoading && !isError && campaign && (
          <div className="space-y-6">
            <MilestoneOverviewCard
              progressPercent={progress}
              milestones={milestones}
              goalWei={campaign.goal}
              raisedWei={campaign.raised}
            />

            <MilestoneTimeline
              milestones={milestones}
              campaignId={campaign.id}
              contractAddress={contractConfig.address}
            />
          </div>
        )}
      </main>
    </div>
  );
}
