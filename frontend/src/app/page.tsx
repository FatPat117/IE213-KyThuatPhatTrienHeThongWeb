'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useSyncExternalStore } from 'react';
import { useAccount, useChainId } from 'wagmi';
import WalletStatus from '@/components/wallet/WalletStatus';
import { ContractStatsDisplay, CampaignListDisplay } from '@/components/contract/ContractReadComponent';

const SEPOLIA_CHAIN_ID = 11155111;
const EMPTY_SUBSCRIBE = () => () => {};

function useIsHydrated() {
  return useSyncExternalStore(EMPTY_SUBSCRIBE, () => true, () => false);
}

function HomeContent() {
  const isHydrated = useIsHydrated();
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const isSepoliaNetwork = chainId === SEPOLIA_CHAIN_ID;
  const safeIsConnected = isHydrated && isConnected;
  const safeIsSepoliaNetwork = isHydrated && isSepoliaNetwork;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 to-slate-50 text-slate-900">
      <main className="mx-auto w-full max-w-6xl flex flex-col gap-24 px-6 py-20 md:px-10 lg:gap-28">
        {/* Hero Section */}
        <section className="grid gap-14 lg:grid-cols-[1fr_1.05fr] lg:items-center">
          <div className="flex flex-col gap-8">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-indigo-500/10 px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-indigo-600">
                Blockchain-powered
              </span>
              {!safeIsConnected && (
                <span className="rounded-full bg-amber-500/10 px-3.5 py-1 text-xs font-semibold text-amber-700">
                  Chế độ xem
                </span>
              )}
              {safeIsConnected && !safeIsSepoliaNetwork && (
                <span className="rounded-full bg-red-500/10 px-3.5 py-1 text-xs font-semibold text-red-700">
                  Sai mạng
                </span>
              )}
              {safeIsConnected && safeIsSepoliaNetwork && (
                <span className="rounded-full bg-emerald-500/10 px-3.5 py-1 text-xs font-semibold text-emerald-700">
                  Đã kết nối Sepolia
                </span>
              )}
            </div>

            <div className="space-y-5">
              <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl lg:text-[2.75rem] lg:leading-[1.15]">
                Quyên góp minh bạch trên Ethereum
              </h1>
              <p className="max-w-xl text-lg leading-relaxed text-slate-600">
                Mỗi khoản quyên góp được ghi trên blockchain. Không trung gian, đầy đủ minh bạch. Xem dữ liệu mọi lúc — kể cả khi chưa kết nối ví.
              </p>
            </div>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <Link
                href="/campaigns/create"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-indigo-600/25 transition hover:bg-indigo-700 hover:shadow-indigo-600/30"
              >
                Bắt đầu chiến dịch
              </Link>
              <Link
                href="/campaigns"
                className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-6 py-3.5 text-base font-semibold text-slate-700 transition hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50/50"
              >
                Duyệt chiến dịch
              </Link>
            </div>

            <div className="flex gap-10 border-t border-slate-200/80 pt-8">
              <div>
                <p className="text-sm font-medium text-slate-500">Chiến dịch</p>
                <p className="mt-0.5 text-2xl font-bold text-slate-900">On-chain</p>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500">Cộng đồng</p>
                <p className="mt-0.5 text-2xl font-bold text-slate-900">Mở</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-5">
            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xl shadow-slate-200/50 ring-1 ring-slate-900/5">
              <div className="mb-4 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-emerald-500/30" />
                <span className="text-sm font-medium text-slate-600">Dữ liệu on-chain trực tiếp</span>
              </div>
              <ContractStatsDisplay />
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-lg shadow-slate-200/40 ring-1 ring-slate-900/5">
              <p className="mb-3 text-sm font-semibold text-slate-700">Kết nối ví</p>
              <WalletStatus />
            </div>
          </div>
        </section>

        {/* Key Features Section */}
        <section className="flex flex-col gap-12">
          <div className="text-center">
            <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-indigo-600">
              Lợi ích
            </p>
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Tại sao chọn quyên góp phi tập trung?
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-lg text-slate-600">
              Minh bạch, an toàn và dễ tiếp cận trong mỗi giao dịch.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <div className="group rounded-2xl border border-slate-200/80 bg-white p-8 shadow-sm ring-1 ring-slate-900/5 transition hover:shadow-md hover:ring-indigo-500/10">
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 transition group-hover:bg-indigo-500/15">
                <span className="text-2xl" aria-hidden>🔒</span>
              </div>
              <h3 className="text-lg font-bold text-slate-900">Hoàn toàn minh bạch</h3>
              <p className="mt-2 text-slate-600 leading-relaxed">
                Mọi giao dịch được ghi trên blockchain. Bạn luôn biết từng khoản quyên góp đi đâu.
              </p>
            </div>
            <div className="group rounded-2xl border border-slate-200/80 bg-white p-8 shadow-sm ring-1 ring-slate-900/5 transition hover:shadow-md hover:ring-indigo-500/10">
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 transition group-hover:bg-indigo-500/15">
                <span className="text-2xl" aria-hidden>⚡</span>
              </div>
              <h3 className="text-lg font-bold text-slate-900">Cập nhật thời gian thực</h3>
              <p className="mt-2 text-slate-600 leading-relaxed">
                Tiến trình chiến dịch cập nhật ngay từ blockchain, không trễ, không trung gian.
              </p>
            </div>
            <div className="group rounded-2xl border border-slate-200/80 bg-white p-8 shadow-sm ring-1 ring-slate-900/5 transition hover:shadow-md hover:ring-indigo-500/10 sm:col-span-2 lg:col-span-1">
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 transition group-hover:bg-indigo-500/15">
                <span className="text-2xl" aria-hidden>🌍</span>
              </div>
              <h3 className="text-lg font-bold text-slate-900">Toàn cầu & dễ tiếp cận</h3>
              <p className="mt-2 text-slate-600 leading-relaxed">
                Không giới hạn địa lý. Ai có ví đều có thể tham gia tài trợ từ bất kỳ đâu.
              </p>
            </div>
          </div>
        </section>

        {/* Featured Campaigns Section */}
        <section className="flex flex-col gap-8 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-lg shadow-slate-200/30 ring-1 ring-slate-900/5 md:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="mb-1 text-sm font-semibold uppercase tracking-wider text-indigo-600">
                Khám phá
              </p>
              <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                Chiến dịch nổi bật
              </h2>
              <p className="mt-2 text-slate-600">
                Các chiến dịch đang hoạt động, tạo tác động thực trên blockchain
              </p>
            </div>
            <Link
              href="/campaigns"
              className="inline-flex w-fit items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50/50"
            >
              Xem tất cả
              <span className="text-slate-400" aria-hidden>→</span>
            </Link>
          </div>
          <div>
            <CampaignListDisplay />
          </div>
        </section>

        {/* How It Works Section */}
        <section id="about" className="flex flex-col gap-12">
          <div className="text-center">
            <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-indigo-600">
              Quy trình
            </p>
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Hoạt động như thế nào
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-lg text-slate-600">
              4 bước đơn giản để khởi chạy hoặc hỗ trợ chiến dịch
            </p>
          </div>

          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { step: 1, title: 'Kết nối ví', desc: 'Liên kết MetaMask hoặc ví ưa thích trên mạng Sepolia.' },
              { step: 2, title: 'Tạo chiến dịch', desc: 'Đặt mục tiêu, thời hạn và mô tả chiến dịch trên chuỗi khối.' },
              { step: 3, title: 'Chia sẻ & quyên góp', desc: 'Quảng bá và theo dõi quyên góp theo thời gian thực.' },
              { step: 4, title: 'Rút tiền', desc: 'Rút tiền an toàn khi chiến dịch đạt mục tiêu.' },
            ].map(({ step, title, desc }) => (
              <div key={step} className="flex flex-col">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600 text-base font-bold text-white shadow-lg shadow-indigo-600/20">
                  {step}
                </div>
                <h3 className="mt-4 text-lg font-bold text-slate-900">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Network Info Section */}
        <section className="flex flex-col gap-10 rounded-2xl border border-slate-200/80 bg-white p-8 shadow-lg shadow-slate-200/30 ring-1 ring-slate-900/5 md:p-10">
          <div className="text-center">
            <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-indigo-600">
              Hạ tầng
            </p>
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Xây dựng trên Ethereum Sepolia
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-lg text-slate-600">
              Mọi chiến dịch, quyên góp và cột mốc được ghi vĩnh viễn trên blockchain — minh bạch hoàn toàn.
            </p>
          </div>
          <div className="grid gap-8 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Mạng</p>
              <p className="mt-2 text-xl font-bold text-slate-900">Ethereum Sepolia</p>
              <p className="mt-1 text-sm text-slate-600">Mạng thử nghiệm để phát triển và kiểm tra</p>
            </div>
            <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Chain ID</p>
              <p className="mt-2 text-xl font-bold text-slate-900 font-mono">11155111</p>
              <p className="mt-1 text-sm text-slate-600">Định danh mạng duy nhất</p>
            </div>
            <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Công nghệ</p>
              <p className="mt-2 text-xl font-bold text-slate-900">Smart contracts</p>
              <p className="mt-1 text-sm text-slate-600">Tự động hóa trên Solidity</p>
            </div>
          </div>
        </section>

        {/* Final CTA Section */}
        <section className="rounded-2xl bg-indigo-600 px-8 py-14 text-center shadow-xl shadow-indigo-600/20 md:px-12">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Sẵn sàng tạo ra sự thay đổi?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-indigo-100">
            Bắt đầu chiến dịch, hỗ trợ mục đích, hoặc theo dõi đóng góp trên blockchain. Tham gia cộng đồng ngay.
          </p>
          <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:justify-center">
            {safeIsConnected && safeIsSepoliaNetwork ? (
              <Link
                href="/campaigns/create"
                className="inline-flex items-center justify-center rounded-xl bg-white px-8 py-3.5 text-base font-bold text-indigo-600 shadow-lg transition hover:bg-indigo-50"
              >
                Bắt đầu chiến dịch
              </Link>
            ) : (
              <button
                className="inline-flex cursor-not-allowed items-center justify-center rounded-xl bg-white/20 px-8 py-3.5 text-base font-bold text-white"
                disabled
                title={!isConnected ? 'Kết nối ví để tạo chiến dịch' : 'Chuyển sang mạng Sepolia'}
              >
                Bắt đầu chiến dịch
              </button>
            )}
            <Link
              href="/campaigns"
              className="inline-flex items-center justify-center rounded-xl border-2 border-white/80 px-8 py-3.5 text-base font-bold text-white transition hover:bg-white/10"
            >
              Duyệt chiến dịch
            </Link>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-slate-200/80 pt-14 pb-10">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col gap-3">
              <p className="text-lg font-bold text-slate-900">FundRaising</p>
              <p className="text-sm leading-relaxed text-slate-600">
                Nền tảng quyên góp phi tập trung trên blockchain.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <p className="text-sm font-semibold text-slate-900">Nền tảng</p>
              <Link href="/campaigns" className="text-sm text-slate-600 transition hover:text-indigo-600">
                Duyệt chiến dịch
              </Link>
              <Link href="/leaderboard" className="text-sm text-slate-600 transition hover:text-indigo-600">
                Bảng xếp hạng
              </Link>
              <Link href="/campaigns/create" className="text-sm text-slate-600 transition hover:text-indigo-600">
                Tạo chiến dịch
              </Link>
              <Link href="/dashboard" className="text-sm text-slate-600 transition hover:text-indigo-600">
                Tổng quan
              </Link>
              <Link href="/donations" className="text-sm text-slate-600 transition hover:text-indigo-600">
                Quyên góp của tôi
              </Link>
              <Link href="/status" className="text-sm text-slate-600 transition hover:text-indigo-600">
                Trạng thái hệ thống
              </Link>
            </div>
            <div className="flex flex-col gap-3">
              <p className="text-sm font-semibold text-slate-900">Mạng</p>
              <a href="https://sepolia.etherscan.io" target="_blank" rel="noopener noreferrer" className="text-sm text-slate-600 transition hover:text-indigo-600">
                Etherscan Sepolia
              </a>
              <a href="https://faucet.sepolia.dev" target="_blank" rel="noopener noreferrer" className="text-sm text-slate-600 transition hover:text-indigo-600">
                Faucet Sepolia
              </a>
            </div>
            <div className="flex flex-col gap-3">
              <p className="text-sm font-semibold text-slate-900">Về chúng tôi</p>
              <p className="text-sm text-slate-600">
                Dự án IE213 — Công nghệ Phát triển Web, UIT
              </p>
            </div>
          </div>
          <div className="mt-12 border-t border-slate-200/80 pt-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-500">© 2024 FundRaising. Bảo lưu mọi quyền.</p>
              <div className="flex gap-6 text-sm text-slate-500">
                <a href="#" className="transition hover:text-indigo-600">Riêng tư</a>
                <a href="#" className="transition hover:text-indigo-600">Điều khoản</a>
                <a href="#" className="transition hover:text-indigo-600">Liên hệ</a>
              </div>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}

const Home = dynamic(async () => HomeContent, {
  ssr: false,
});

export default Home;
