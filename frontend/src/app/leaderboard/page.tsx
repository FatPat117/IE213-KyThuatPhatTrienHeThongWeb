'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { formatEther, parseAbiItem } from 'viem';
import { useAccount, usePublicClient } from 'wagmi';
import BackButton from '@/components/navigation/BackButton';
import { API_BASE_URL } from '@/lib/api/client';
import {
  contractConfig,
  getCampaignMetadataFromCache,
  useBackendCampaigns,
  useReadAllCampaigns,
} from '@/lib';

type DonorStat = {
  donor: string;
  totalAmountEth: number;
};

export default function LeaderboardPage() {
  const { chain } = useAccount();
  const campaignsQuery = useBackendCampaigns();
  const onChainQuery = useReadAllCampaigns();
  const publicClient = usePublicClient({ chainId: contractConfig.chainId });

  const [donorStats, setDonorStats] = useState<DonorStat[]>([]);
  const [isDonorLoading, setIsDonorLoading] = useState(false);
  const [donorError, setDonorError] = useState<string | null>(null);

  // Ưu tiên backend indexer (đầy đủ lịch sử Donated). Fallback on-chain 2000 block gần nhất nếu API lỗi.
  const DONATED_LOG_CHUNK_SIZE = 10n;
  const DONATED_MAX_BLOCKS = 2000n;

  useEffect(() => {
    const loadDonorLeaderboard = async () => {
      try {
        setIsDonorLoading(true);
        setDonorError(null);

        const res = await fetch(
          `${API_BASE_URL}/donations/leaderboard/top-donors?limit=10`,
          { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } },
        );
        if (res.ok) {
          const payload = await res.json();
          const rows = Array.isArray(payload?.data) ? payload.data : [];
          const stats: DonorStat[] = rows
            .filter((r: { donor?: string; totalAmountEth?: number }) => r?.donor)
            .map((r: { donor: string; totalAmountEth: number }) => ({
              donor: r.donor,
              totalAmountEth: Number(r.totalAmountEth) || 0,
            }));
          setDonorStats(stats);
          return;
        }
        throw new Error(`API ${res.status}`);
      } catch {
        // Fallback: on-chain (2.000 block gần nhất, RPC free tier)
        if (!publicClient) {
          setDonorError('Không thể tải leaderboard. Kiểm tra kết nối backend và ví.');
          setDonorStats([]);
          return;
        }
        try {
          const toBlock = await publicClient.getBlockNumber();
          const fromBlock =
            toBlock > DONATED_MAX_BLOCKS ? toBlock - DONATED_MAX_BLOCKS + 1n : 0n;
          const allLogs: Awaited<ReturnType<typeof publicClient.getLogs>> = [];
          for (let from = fromBlock; from <= toBlock; from += DONATED_LOG_CHUNK_SIZE) {
            const chunkTo =
              from + DONATED_LOG_CHUNK_SIZE - 1n > toBlock
                ? toBlock
                : from + DONATED_LOG_CHUNK_SIZE - 1n;
            const logs = await publicClient.getLogs({
              address: contractConfig.address,
              event: parseAbiItem(
                'event Donated(uint256 indexed campaignId, address indexed donor, uint256 amount)',
              ),
              fromBlock: from,
              toBlock: chunkTo,
            });
            allLogs.push(...logs);
          }
          const byDonor = new Map<string, bigint>();
          allLogs.forEach((log) => {
            const args = (log as { args?: { donor?: string; amount?: bigint } }).args;
            const donor = (args?.donor || '').toString();
            if (!donor) return;
            const amount = args?.amount ?? 0n;
            const key = donor.toLowerCase();
            byDonor.set(key, (byDonor.get(key) ?? 0n) + amount);
          });
          const stats: DonorStat[] = Array.from(byDonor.entries())
            .map(([donor, totalAmount]) => ({
              donor,
              totalAmountEth: Number(formatEther(totalAmount)),
            }))
            .sort((a, b) => b.totalAmountEth - a.totalAmountEth);
          setDonorStats(stats);
        } catch (err) {
          setDonorError(
            err instanceof Error
              ? err.message
              : 'Không thể tải leaderboard donor từ on-chain.',
          );
          setDonorStats([]);
        }
      } finally {
        setIsDonorLoading(false);
      }
    };

    loadDonorLeaderboard();
  }, [publicClient]);

  const normalizedCampaigns = useMemo(() => {
    const map = new Map<
      number,
      {
        id: number;
        title: string;
        goal: bigint;
        raised: bigint;
        completed: boolean;
      }
    >();

    campaignsQuery.data.forEach((c) => {
      map.set(c.onChainId, {
        id: c.onChainId,
        title:
          getCampaignMetadataFromCache(c.onChainId)?.title ||
          c.title ||
          `Campaign #${c.onChainId}`,
        goal: BigInt(c.goal || '0'),
        raised: BigInt(c.raised || '0'),
        completed: c.status !== 'active',
      });
    });

    onChainQuery.campaigns.forEach((c) => {
      const existing = map.get(c.id);
      const cached = getCampaignMetadataFromCache(c.id);
      map.set(c.id, {
        id: c.id,
        title:
          existing?.title ||
          cached?.title ||
          `Campaign #${c.id}`,
        goal: c.goal,
        raised: c.raised,
        completed: c.completed,
      });
    });

    return Array.from(map.values());
  }, [campaignsQuery.data, onChainQuery.campaigns]);

  const topCampaignsByRaised = useMemo(
    () =>
      [...normalizedCampaigns]
        .sort((a, b) => Number(b.raised) - Number(a.raised))
        .slice(0, 10),
    [normalizedCampaigns],
  );

  const topDonors = useMemo(
    () => donorStats.slice(0, 10),
    [donorStats],
  );

  const [period, setPeriod] = useState<'all' | 'week' | 'month'>('all');

  const rankBadgeClass = (index: number) => {
    if (index === 0) return 'bg-amber-100 text-amber-800 border-amber-300';
    if (index === 1) return 'bg-slate-200 text-slate-800 border-slate-400';
    if (index === 2) return 'bg-amber-700/20 text-amber-900 border-amber-600';
    return 'bg-slate-100 text-slate-700 border-slate-200';
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white text-slate-900">
      <main className="mx-auto w-full max-w-6xl px-6 py-12 md:px-10">
        <div className="mb-6">
          <BackButton fallbackHref="/" />
        </div>
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-1 text-sm font-semibold uppercase tracking-wider text-indigo-600">Bảng xếp hạng</p>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Top chiến dịch & nhà hảo tâm
            </h1>
            <p className="mt-2 max-w-xl text-slate-600">
              Dữ liệu on-chain. Top chiến dịch theo tổng ETH raised, top donor theo tổng quyên góp.
            </p>
          </div>
          {chain?.id !== 11155111 && (
            <div className="rounded-full border border-red-200 bg-red-50 px-4 py-1.5 text-xs font-semibold text-red-700">
              Khuyến nghị dùng mạng Sepolia để số liệu trùng khớp.
            </div>
          )}
        </div>

        {/* Period filter - only "all" is supported by data */}
        <div className="mb-6 flex gap-2">
          {(['all', 'week', 'month'] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              disabled={p !== 'all'}
              className={`rounded-lg border px-4 py-2 text-sm font-semibold transition ${
                period === p
                  ? 'border-indigo-500 bg-indigo-600 text-white'
                  : p === 'all'
                  ? 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                  : 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400'
              }`}
            >
              {p === 'all' ? 'Tất cả' : p === 'week' ? 'Tuần' : 'Tháng'}
              {p !== 'all' && (
                <span className="ml-1.5 text-xs font-normal opacity-80">(sắp ra mắt)</span>
              )}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          {/* Top campaigns by raised */}
          <section className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm ring-1 ring-slate-900/5">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Chiến dịch gây quỹ nhiều nhất
                </h2>
                <p className="mt-1 text-xs text-slate-600">
                  Xếp hạng theo tổng ETH đã gây quỹ (không theo %).
                </p>
              </div>
              <Link
                href="/campaigns"
                className="text-sm font-semibold text-indigo-600 hover:text-indigo-700"
              >
                Xem tất cả →
              </Link>
            </div>

            {campaignsQuery.isLoading || onChainQuery.isLoading ? (
              <p className="text-sm text-slate-600">Đang tải dữ liệu chiến dịch...</p>
            ) : topCampaignsByRaised.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                Chưa có chiến dịch nào để xếp hạng.
              </p>
            ) : (
              <div className="space-y-2">
                {topCampaignsByRaised.map((c, index) => {
                  const goalEth = Number(formatEther(c.goal));
                  const raisedEth = Number(formatEther(c.raised));
                  return (
                    <Link
                      key={c.id}
                      href={`/campaigns/${c.id}`}
                      className="flex items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-slate-50/80 px-4 py-3 transition hover:border-indigo-300 hover:bg-indigo-50/50 hover:shadow-sm"
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <span
                          className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-bold ${rankBadgeClass(index)}`}
                        >
                          #{index + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">
                            {c.title}
                          </p>
                          <p className="text-xs text-slate-500">
                            Mục tiêu {goalEth.toFixed(2)} ETH
                          </p>
                        </div>
                      </div>
                      <span className="shrink-0 text-sm font-semibold text-emerald-700">
                        {raisedEth.toFixed(4)} ETH
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>

          {/* Top donors */}
          <section className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm ring-1 ring-slate-900/5">
            <div className="mb-5">
              <h2 className="text-lg font-bold text-slate-900">
                Nhà hảo tâm đóng góp nhiều nhất
              </h2>
              <p className="mt-1 text-xs text-slate-600">
                Tổng hợp từ backend indexer sự kiện Donated (fallback on-chain 2.000 block gần nhất nếu API lỗi).
              </p>
            </div>

            {isDonorLoading ? (
              <p className="text-sm text-slate-600">
                Đang tải dữ liệu donor...
              </p>
            ) : donorError ? (
              <p className="text-sm text-red-700">{donorError}</p>
            ) : topDonors.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                Chưa có dữ liệu quyên góp để xếp hạng. Nếu đã có donate trên chain, hãy đảm bảo backend (gateway + donation-service + listener) đang chạy để index event Donated.
              </p>
            ) : (
              <div className="space-y-2">
                {topDonors.map((item, index) => (
                  <div
                    key={item.donor}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-slate-50/80 px-4 py-3 transition hover:border-emerald-300 hover:bg-emerald-50/50 hover:shadow-sm"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <span
                        className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-bold ${rankBadgeClass(index)}`}
                      >
                        #{index + 1}
                      </span>
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-600">
                        {item.donor.slice(2, 4).toUpperCase()}
                      </div>
                      <code className="truncate text-xs font-mono text-slate-900">
                        {item.donor.slice(0, 6)}...{item.donor.slice(-4)}
                      </code>
                    </div>
                    <span className="shrink-0 text-sm font-semibold text-emerald-700">
                      {item.totalAmountEth.toFixed(4)} ETH
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="mt-8 rounded-xl border border-slate-200/80 bg-slate-900 p-6 text-sm text-slate-100 shadow-sm ring-1 ring-slate-900/5">
          <h2 className="mb-2 text-lg font-bold text-white">
            Cách tính leaderboard
          </h2>
          <p className="mb-1">
            • <span className="font-semibold">Chiến dịch</span> dựa trên dữ liệu kết hợp backend campaign-service và contract on-chain.
          </p>
          <p>
            • <span className="font-semibold">Donor</span> lấy từ backend indexer sự kiện{' '}
            <code className="font-mono">Donated</code> (hoặc on-chain 2.000 block gần nhất nếu API lỗi), quy đổi sang ETH.
          </p>
        </div>
      </main>
    </div>
  );
}

