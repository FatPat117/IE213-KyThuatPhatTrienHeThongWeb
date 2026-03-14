'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { formatEther } from 'viem';
import { useAccount } from 'wagmi';
import {
  getCampaignMetadataFromCache,
  isPlaceholderCampaignDescription,
  isPlaceholderCampaignTitle,
  useBackendCampaigns,
  useReadAllCampaigns
} from '@/lib';
import BackButton from '@/components/navigation/BackButton';

function formatEthAmount(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '0';
  if (value < 0.01) return value.toFixed(4).replace(/\.?0+$/, '');
  return value.toFixed(2);
}

export default function MyCampaignsPage() {
  const { address, isConnected, chain } = useAccount();
  const campaignsQuery = useBackendCampaigns();
  const onChainQuery = useReadAllCampaigns();

  const mergedCampaigns = useMemo(() => {
    const map = new Map<
      number,
      {
        onChainId: number;
        title: string;
        description: string;
        creator: string;
        goal: string;
        raised: string;
        status: 'active' | 'ended' | 'failed' | 'cancelled';
      }
    >();

    campaignsQuery.data.forEach((campaign) => {
      const cached = getCampaignMetadataFromCache(campaign.onChainId);
      map.set(campaign.onChainId, {
        onChainId: campaign.onChainId,
        title: !isPlaceholderCampaignTitle(campaign.title, campaign.onChainId)
          ? campaign.title
          : (cached?.title || `Campaign #${campaign.onChainId}`),
        description: !isPlaceholderCampaignDescription(campaign.description)
          ? campaign.description
          : (cached?.description || ''),
        creator: campaign.creator,
        goal: campaign.goal || '0',
        raised: campaign.raised || '0',
        status: campaign.status,
      });
    });

    onChainQuery.campaigns.forEach((campaign) => {
      const inferredStatus: 'active' | 'ended' | 'failed' | 'cancelled' = !campaign.completed
        ? 'active'
        : campaign.raised < campaign.goal
          ? 'failed'
          : 'ended';

      const existing = map.get(campaign.id);
      if (existing) {
        map.set(campaign.id, {
          ...existing,
          creator: campaign.creator,
          goal: campaign.goal.toString(),
          raised: campaign.raised.toString(),
          status: inferredStatus,
        });
      } else {
        const cached = getCampaignMetadataFromCache(campaign.id);
        map.set(campaign.id, {
          onChainId: campaign.id,
          title: cached?.title || `Campaign #${campaign.id}`,
          description: cached?.description || 'Campaign data is stored on-chain without off-chain metadata.',
          creator: campaign.creator,
          goal: campaign.goal.toString(),
          raised: campaign.raised.toString(),
          status: inferredStatus,
        });
      }
    });

    return Array.from(map.values());
  }, [campaignsQuery.data, onChainQuery.campaigns]);

  const myCampaigns = useMemo(
    () =>
      mergedCampaigns.filter(
        (campaign) => !!address && campaign.creator.toLowerCase() === address.toLowerCase()
      ),
    [address, mergedCampaigns]
  );

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white text-slate-900">
        <main className="mx-auto w-full max-w-7xl px-6 py-12 md:px-10">
          <div className="rounded-2xl border-2 border-slate-200 bg-slate-50 p-12 text-center">
            <h2 className="text-2xl font-bold text-slate-900 mb-3">Chưa kết nối ví</h2>
            <p className="text-slate-600 mb-6">Vui lòng kết nối ví để xem chiến dịch của bạn</p>
            <Link
              href="/"
              className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition"
            >
              Về trang chủ
            </Link>
          </div>
        </main>
      </div>
    );
  }

  if (chain?.id !== 11155111) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white text-slate-900">
        <main className="mx-auto w-full max-w-3xl px-6 py-12 md:px-10">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
            <h2 className="text-2xl font-bold text-red-900 mb-2">Sai mạng</h2>
            <p className="text-red-700 mb-6">Vui lòng chuyển sang Sepolia để xem chiến dịch.</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white text-slate-900">
      <main className="mx-auto w-full max-w-7xl px-6 py-12 md:px-10">
        <div className="mb-6">
          <BackButton fallbackHref="/" />
        </div>
        <header className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900">Chiến dịch bạn đã tạo</h1>
          <p className="text-slate-600 mt-2">Dữ liệu đồng bộ từ backend campaign-service.</p>
          <p className="text-xs text-slate-500 mt-2">
            Rút tiền thực hiện trong trang chi tiết từng campaign sau khi chiến dịch kết thúc và đạt mục tiêu.
          </p>
        </header>

        {(campaignsQuery.isLoading || onChainQuery.isLoading) && (
          <p className="text-slate-600">Đang tải dữ liệu...</p>
        )}
        {!campaignsQuery.isLoading && !onChainQuery.isLoading && campaignsQuery.error && onChainQuery.error && (
          <p className="text-red-700">{campaignsQuery.error || onChainQuery.error}</p>
        )}
        {!campaignsQuery.isLoading && !onChainQuery.isLoading && myCampaigns.length === 0 && (
          <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-12 text-center">
            <p className="text-slate-600 mb-6">Bạn chưa có chiến dịch nào.</p>
            <Link
              href="/campaigns/create"
              className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition"
            >
              Tạo chiến dịch đầu tiên
            </Link>
          </div>
        )}

        {!campaignsQuery.isLoading && !onChainQuery.isLoading && myCampaigns.length > 0 && (
          <section className="space-y-10">
            {[
              {
                key: 'active' as const,
                title: 'Đang diễn ra',
                description: 'Các chiến dịch đang mở và có thể tiếp tục nhận quyên góp.',
              },
              {
                key: 'ended' as const,
                title: 'Đã kết thúc',
                description: 'Chiến dịch đã kết thúc, có thể rút tiền nếu đạt mục tiêu.',
              },
              {
                key: 'failed' as const,
                title: 'Thất bại',
                description: 'Chiến dịch không đạt mục tiêu, donor có thể yêu cầu hoàn tiền.',
              },
            ].map((group) => {
              const campaignsInGroup = myCampaigns.filter(
                (campaign) => campaign.status === group.key
              );

              return (
                <div key={group.key} className="space-y-4">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-900">{group.title}</h2>
                    <p className="mt-1 text-sm text-slate-600">{group.description}</p>
                  </div>

                  {campaignsInGroup.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                      Chưa có chiến dịch nào thuộc nhóm này.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                      {campaignsInGroup.map((campaign) => {
                        const goalEth = Number(formatEther(BigInt(campaign.goal || '0')));
                        const raisedEth = Number(formatEther(BigInt(campaign.raised || '0')));
                        const progress = goalEth > 0 ? (raisedEth / goalEth) * 100 : 0;

                        const statusStyles =
                          campaign.status === 'active'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : campaign.status === 'ended'
                            ? 'bg-slate-100 text-slate-700 border-slate-200'
                            : 'bg-red-50 text-red-700 border-red-200';

                        const progressBarColor =
                          campaign.status === 'active'
                            ? 'bg-emerald-500'
                            : campaign.status === 'ended'
                            ? 'bg-slate-400'
                            : 'bg-red-500';

                        return (
                          <div
                            key={campaign.onChainId}
                            className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
                          >
                            {/* Header */}
                            <div className="mb-3 flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <h3 className="truncate text-lg font-bold text-slate-900">
                                  {campaign.title || `Campaign #${campaign.onChainId}`}
                                </h3>
                              </div>
                              <span
                                className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${statusStyles}`}
                              >
                                {campaign.status}
                              </span>
                            </div>

                            {/* Body */}
                            <p className="mb-4 line-clamp-3 text-sm text-slate-600">
                              {campaign.description || 'No description'}
                            </p>

                            <div className="mb-4 space-y-2">
                              <div className="flex justify-between text-xs font-medium text-slate-600">
                                <span>Đã huy động: {formatEthAmount(raisedEth)} ETH</span>
                                <span>Mục tiêu: {formatEthAmount(goalEth)} ETH</span>
                              </div>
                              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                                <div
                                  className={`h-full ${progressBarColor} transition-all duration-500`}
                                  style={{ width: `${Math.min(progress, 100)}%` }}
                                />
                              </div>
                              <p className="text-xs text-slate-500">
                                {goalEth > 0
                                  ? `${Math.min(progress, 100).toFixed(1)}% hoàn thành`
                                  : 'Chưa cấu hình mục tiêu'}
                              </p>
                            </div>

                            {/* Status helper text */}
                            <p className="mt-auto text-xs text-slate-500">
                              {campaign.status === 'active'
                                ? 'Đang diễn ra - chưa thể rút tiền'
                                : campaign.status === 'ended'
                                ? 'Đủ điều kiện rút tiền trong trang chi tiết'
                                : 'Chiến dịch failed - không thể rút, donor sẽ yêu cầu refund'}
                            </p>

                            {/* Footer */}
                            <div className="mt-4">
                              <Link
                                href={`/campaigns/${campaign.onChainId}`}
                                className="inline-flex w-full items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 hover:shadow-md"
                              >
                                Quản lý campaign
                              </Link>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </section>
        )}
      </main>
    </div>
  );
}
