'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { formatEther } from 'viem';
import { useAccount } from 'wagmi';
import { useBackendCampaigns, useReadAllCampaigns } from '@/lib';
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
      map.set(campaign.onChainId, {
        onChainId: campaign.onChainId,
        title: campaign.title || `Campaign #${campaign.onChainId}`,
        description: campaign.description || '',
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
        map.set(campaign.id, {
          onChainId: campaign.id,
          title: `Campaign #${campaign.id}`,
          description: 'Campaign data is stored on-chain without off-chain metadata.',
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {myCampaigns.map((campaign) => {
              const goalEth = Number(formatEther(BigInt(campaign.goal || '0')));
              const raisedEth = Number(formatEther(BigInt(campaign.raised || '0')));
              const progress = goalEth > 0 ? (raisedEth / goalEth) * 100 : 0;

              return (
                <Link
                  key={campaign.onChainId}
                  href={`/campaigns/${campaign.onChainId}`}
                  className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-all duration-300"
                >
                  <h3 className="text-lg font-bold text-slate-900 mb-2 group-hover:text-blue-600 transition">
                    {campaign.title || `Campaign #${campaign.onChainId}`}
                  </h3>
                  <p className="text-sm text-slate-600 mb-4 line-clamp-2">{campaign.description || 'No description'}</p>
                  <div className="mb-4">
                    <p className="text-sm text-slate-700">
                      {formatEthAmount(raisedEth)} / {formatEthAmount(goalEth)} ETH
                    </p>
                    <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden mt-2">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-500"
                        style={{ width: `${Math.min(progress, 100)}%` }}
                      />
                    </div>
                  </div>
                  <p className="text-sm font-semibold text-blue-600">{campaign.status}</p>
                  <p className="mt-2 text-xs text-slate-500">
                    {campaign.status === 'active'
                      ? 'Đang diễn ra - chưa thể rút tiền'
                      : campaign.status === 'ended'
                        ? 'Đủ điều kiện rút tiền trong trang chi tiết'
                        : 'Chiến dịch failed - không thể rút, donor sẽ yêu cầu refund'}
                  </p>
                  <p className="mt-3 text-sm font-semibold text-blue-600 group-hover:text-blue-700">
                    Quản lý campaign →
                  </p>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
