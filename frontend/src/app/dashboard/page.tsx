'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useAccount } from 'wagmi';
import { formatEther } from 'viem';
import { API_BASE_URL } from '@/lib/api/client';
import { useBackendCampaigns, useBackendDonations } from '@/lib';
import BackButton from '@/components/navigation/BackButton';
import DonationSummaryCards from '@/components/donations/DonationSummaryCards';
import type { DonationRecord } from '@/lib/api/types';

type CertificateOverview = {
  tokenId: number;
  campaignOnChainId: number;
  mintedAt: string;
};

export default function DashboardPage() {
  const { address, isConnected, chain } = useAccount();
  const campaignsQuery = useBackendCampaigns();
  const donationsQuery = useBackendDonations(address ?? null);
  const [certificates, setCertificates] = useState<CertificateOverview[]>([]);
  const [isCertLoading, setIsCertLoading] = useState(false);
  const [certError, setCertError] = useState<string | null>(null);

  useEffect(() => {
    const loadCertificates = async () => {
      if (!address || !isConnected) {
        setCertificates([]);
        return;
      }
      try {
        setIsCertLoading(true);
        setCertError(null);
        const res = await fetch(`${API_BASE_URL}/certificates/owner/${address}`, {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
        });
        if (!res.ok) {
          const text = await res.text();
          let msg = 'Không thể tải chứng chỉ của bạn.';
          try {
            const json = JSON.parse(text);
            if (json?.error) msg = json.error;
          } catch {
            if (text) msg = `${msg} (${res.status})`;
          }
          throw new Error(msg);
        }
        const payload = await res.json();
        const rows = Array.isArray(payload?.data) ? payload.data : [];
        rows.sort(
          (a: CertificateOverview, b: CertificateOverview) =>
            new Date(b.mintedAt).getTime() - new Date(a.mintedAt).getTime(),
        );
        setCertificates(rows);
      } catch (err) {
        setCertError(err instanceof Error ? err.message : 'Lỗi không xác định khi tải chứng chỉ.');
      } finally {
        setIsCertLoading(false);
      }
    };

    loadCertificates();
  }, [address, isConnected]);

  const myCampaigns = useMemo(
    () =>
      campaignsQuery.data.filter(
        (c) => !!address && c.creator.toLowerCase() === address.toLowerCase(),
      ),
    [address, campaignsQuery.data],
  );

  const totalRaisedByMyCampaignsEth = useMemo(() => {
    return myCampaigns.reduce((sum, c) => {
      const raised = Number(formatEther(BigInt(c.raised || '0')));
      return sum + (Number.isFinite(raised) ? raised : 0);
    }, 0);
  }, [myCampaigns]);

  const myDonations: DonationRecord[] = useMemo(
    () => donationsQuery.data,
    [donationsQuery.data],
  );

  const totalDonatedEth = useMemo(
    () =>
      myDonations.reduce((sum, d) => {
        const val = d.amountEth ?? Number(formatEther(BigInt(d.amount || '0')));
        return sum + (Number.isFinite(val) ? val : 0);
      }, 0),
    [myDonations],
  );

  const latestDonations = useMemo(
    () =>
      [...myDonations]
        .sort(
          (a, b) =>
            new Date(b.donatedAt).getTime() - new Date(a.donatedAt).getTime(),
        )
        .slice(0, 5),
    [myDonations],
  );

  const latestCertificates = useMemo(
    () => certificates.slice(0, 4),
    [certificates],
  );

  if (!isConnected || !address) {
    return (
      <div className="min-h-screen bg-linear-to-b from-slate-50 to-white">
        <main className="mx-auto w-full max-w-5xl px-6 py-12 md:px-10">
          <div className="mb-6">
            <BackButton fallbackHref="/" />
          </div>
          <div className="rounded-2xl border-2 border-slate-200 bg-slate-50 p-10 text-center">
            <h1 className="text-3xl font-bold text-slate-900 mb-3">
              Cần kết nối ví để xem dashboard
            </h1>
            <p className="text-slate-600 mb-6">
              Kết nối ví để xem tổng quan quyên góp, chiến dịch bạn đã tạo và chứng chỉ NFT.
            </p>
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Về trang chủ
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white text-slate-900">
      <main className="mx-auto w-full max-w-6xl px-6 py-12 md:px-10">
        <div className="mb-6">
          <BackButton fallbackHref="/" />
        </div>
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-1 text-sm font-semibold uppercase tracking-wider text-indigo-600">Tổng quan</p>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Tổng quan tài khoản
            </h1>
            <p className="mt-2 max-w-xl text-slate-600">
              Toàn cảnh hoạt động quyên góp và chiến dịch của bạn trên hệ thống.
            </p>
          </div>
          {chain?.id !== 11155111 && (
            <div className="rounded-full border border-red-200 bg-red-50 px-4 py-1.5 text-xs font-semibold text-red-700">
              Sai mạng – Vui lòng chuyển sang Sepolia để dữ liệu chính xác.
            </div>
          )}
        </div>

        <DonationSummaryCards
          wallet={address}
          donationCount={myDonations.length}
          totalEth={totalDonatedEth.toFixed(4)}
          campaignCount={myCampaigns.length}
        />

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.2fr_1fr]">
          {/* Left column: My campaigns & donations */}
          <section className="space-y-6">
            <div className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm ring-1 ring-slate-900/5 transition hover:shadow-md">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    Chiến dịch bạn đã tạo
                  </h2>
                  <p className="text-xs text-slate-600">
                    Đồng bộ từ backend campaign-service + on-chain.
                  </p>
                </div>
                <Link
                  href="/my-campaigns"
                  className="text-xs font-semibold text-blue-600 hover:text-blue-700"
                >
                  Xem tất cả →
                </Link>
              </div>
              {campaignsQuery.isLoading ? (
                <p className="text-sm text-slate-600">Đang tải chiến dịch...</p>
              ) : myCampaigns.length === 0 ? (
                <p className="text-sm text-slate-600">
                  Bạn chưa có chiến dịch nào. Hãy bắt đầu chiến dịch đầu tiên!
                </p>
              ) : (
                <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
                  {myCampaigns.map((c) => {
                    const goalEth = Number(
                      formatEther(BigInt(c.goal || '0')),
                    );
                    const raisedEth = Number(
                      formatEther(BigInt(c.raised || '0')),
                    );
                    const progress =
                      goalEth > 0 ? Math.min((raisedEth / goalEth) * 100, 100) : 0;
                    return (
                      <Link
                        key={c.onChainId}
                        href={`/campaigns/${c.onChainId}`}
                        className="block rounded-xl border border-slate-200/80 bg-slate-50/80 px-4 py-3 transition hover:border-indigo-300 hover:bg-slate-100 hover:shadow-sm"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">
                              {c.title || `Campaign #${c.onChainId}`}
                            </p>
                            <p className="text-xs text-slate-500">
                              {raisedEth.toFixed(4)} / {goalEth.toFixed(2)} ETH
                            </p>
                          </div>
                          <p className="text-xs font-semibold text-slate-700">
                            {progress.toFixed(1)}%
                          </p>
                        </div>
                      </Link>
                    );
                  })}
                  <div className="mt-4 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-800">
                    Tổng ETH đã gây quỹ qua các chiến dịch của bạn:{' '}
                    <span className="font-semibold">
                      {totalRaisedByMyCampaignsEth.toFixed(4)} ETH
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm ring-1 ring-slate-900/5 transition hover:shadow-md">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    Quyên góp gần đây của bạn
                  </h2>
                  <p className="text-xs text-slate-600">
                    Kết hợp backend indexer và log on-chain.
                  </p>
                </div>
                <Link
                  href="/donations"
                  className="text-xs font-semibold text-blue-600 hover:text-blue-700"
                >
                  Xem chi tiết →
                </Link>
              </div>
              {donationsQuery.isLoading ? (
                <p className="text-sm text-slate-600">Đang tải lịch sử quyên góp...</p>
              ) : latestDonations.length === 0 ? (
                <p className="text-sm text-slate-600">
                  Bạn chưa có quyên góp nào. Hãy ủng hộ một chiến dịch ngay hôm nay!
                </p>
              ) : (
                <div className="space-y-3">
                  {latestDonations.map((d) => (
                    <div
                      key={d.txHash}
                      className="flex items-center justify-between rounded-xl border border-slate-200/60 bg-slate-50/80 px-4 py-3 transition hover:bg-slate-100"
                    >
                      <div>
                        <p className="text-xs text-slate-500">
                          Campaign #{d.campaignOnChainId}
                        </p>
                        <p className="text-xs text-slate-500">
                          {new Date(d.donatedAt).toLocaleString('vi-VN')}
                        </p>
                      </div>
                      <p className="text-sm font-semibold text-emerald-700">
                        +{d.amountEth.toFixed(4)} ETH
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Right column: certificates & quick links */}
          <aside className="space-y-6">
            <div className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm ring-1 ring-slate-900/5 transition hover:shadow-md">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    Chứng chỉ NFT của bạn
                  </h2>
                  <p className="text-xs text-slate-600">
                    Lấy từ backend indexer sự kiện CertificateMinted.
                  </p>
                </div>
                <Link
                  href="/certificates"
                  className="text-xs font-semibold text-blue-600 hover:text-blue-700"
                >
                  Xem tất cả →
                </Link>
              </div>
              {isCertLoading ? (
                <p className="text-sm text-slate-600">Đang tải chứng chỉ...</p>
              ) : certError ? (
                <p className="text-sm text-red-700">{certError}</p>
              ) : certificates.length === 0 ? (
                <p className="text-sm text-slate-600">
                  Bạn chưa có chứng chỉ nào. Sau khi donate và mint, chứng chỉ sẽ xuất hiện ở
                  đây.
                </p>
              ) : (
                <div className="space-y-3">
                  {latestCertificates.map((c) => (
                    <div
                      key={c.tokenId}
                      className="flex items-center justify-between rounded-xl border border-slate-200/60 bg-slate-50/80 px-4 py-3 transition hover:bg-slate-100"
                    >
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          Certificate #{c.tokenId}
                        </p>
                        <p className="text-xs text-slate-500">
                          Campaign #{c.campaignOnChainId}
                        </p>
                        <p className="text-xs text-slate-500">
                          Minted:{' '}
                          {new Date(c.mintedAt).toLocaleDateString('vi-VN')}
                        </p>
                      </div>
                      <Link
                        href="/certificates"
                        className="text-xs font-semibold text-blue-600 hover:text-blue-700"
                      >
                        Xem
                      </Link>
                    </div>
                  ))}
                  {certificates.length > 4 && (
                    <p className="pt-1 text-xs text-slate-500">
                      Và {certificates.length - 4} chứng chỉ khác...
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-slate-200/80 bg-slate-900 p-6 text-slate-50 shadow-sm ring-1 ring-slate-900/5">
              <h2 className="mb-3 text-lg font-bold">Làm gì tiếp theo?</h2>
              <ul className="space-y-2.5 text-sm">
                <li>
                  • <Link href="/campaigns" className="font-semibold text-blue-200 hover:text-white">Duyệt chiến dịch</Link> để tìm mục tiêu bạn muốn ủng hộ.
                </li>
                <li>
                  • <Link href="/campaigns/create" className="font-semibold text-blue-200 hover:text-white">Tạo chiến dịch mới</Link> nếu bạn có ý tưởng gây quỹ.
                </li>
                <li>
                  • <Link href="/status" className="font-semibold text-blue-200 hover:text-white">Kiểm tra trạng thái hệ thống</Link> (ví, mạng, RPC, contract).
                </li>
              </ul>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}

