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
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white text-slate-900">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-20 px-6 py-16 md:px-10">
        {/* Hero Section */}
        <section className="grid gap-12 md:grid-cols-[1fr_1.1fr] md:items-center">
          {/* Hero Content */}
          <div className="flex flex-col gap-6">
            <div className="inline-flex items-center gap-2 w-fit flex-wrap">
              <span className="text-xs font-semibold text-blue-600 bg-blue-100 px-3 py-1 rounded-full">
                🔗 Được hỗ trợ bởi Blockchain
              </span>
              {!safeIsConnected && (
                <span className="text-xs font-semibold text-amber-600 bg-amber-100 px-3 py-1 rounded-full">
                  👁️ Chế độ xem (read-only)
                </span>
              )}
              {safeIsConnected && !safeIsSepoliaNetwork && (
                <span className="text-xs font-semibold text-red-600 bg-red-100 px-3 py-1 rounded-full">
                  ⚠️ Sai mạng
                </span>
              )}
              {safeIsConnected && safeIsSepoliaNetwork && (
                <span className="text-xs font-semibold text-green-600 bg-green-100 px-3 py-1 rounded-full">
                  ✓ Kết nối Sepolia
                </span>
              )}
            </div>

            <div className="flex flex-col gap-4">
              <h1 className="text-4xl md:text-5xl font-bold leading-tight text-slate-900">
                Quyên góp minh bạch trên Ethereum
              </h1>
              <p className="text-lg text-slate-600">
                Mỗi khoản quyên góp được ghi lại trên blockchain. Không có trung gian. Đầy đủ minh bạch. Bạn có thể xem dữ liệu ngay cả khi chưa kết nối ví.
              </p>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <Link
                href="/campaigns/create"
                className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition duration-200 shadow-lg hover:shadow-xl"
              >
                Bắt đầu chiến dịch
              </Link>
              <Link
                href="/campaigns"
                className="inline-flex items-center justify-center px-6 py-3 rounded-lg border-2 border-slate-200 text-slate-900 font-semibold hover:border-blue-600 hover:text-blue-600 transition duration-200"
              >
                Duyệt chiến dịch
              </Link>
            </div>

            {/* Stats Teaser */}
            <div className="flex gap-6 pt-4">
              <div className="flex flex-col">
                <p className="text-sm font-medium text-slate-600">Chiến dịch</p>
                <p className="text-2xl font-bold text-slate-900">Đang hoạt động</p>
              </div>
              <div className="flex flex-col">
                <p className="text-sm font-medium text-slate-600">Cộng đồng</p>
                <p className="text-2xl font-bold text-slate-900">Đang phát triển</p>
              </div>
            </div>
          </div>

          {/* Hero Visual */}
          <div className="flex flex-col gap-4">
            {/* Stats Card */}
            <div className="rounded-2xl bg-white border border-slate-200 p-6 shadow-lg hover:shadow-xl transition">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
                <p className="text-sm font-semibold text-slate-600">Dữ liệu trên chuỗi khối trực tiếp</p>
              </div>
              <div className="space-y-4">
                <ContractStatsDisplay />
              </div>
            </div>

            {/* Wallet Status Card */}
            <div className="rounded-2xl bg-gradient-to-br from-blue-50 to-slate-50 border border-slate-200 p-6 shadow-lg">
              <p className="text-sm font-semibold text-slate-700 mb-3">Kết nối ví</p>
              <WalletStatus />
            </div>
          </div>
        </section>

        {/* Key Features Section */}
        <section className="flex flex-col gap-8">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
              Tại sao chọn quyên góp phi tập trung?
            </h2>
            <p className="text-lg text-slate-600">
              Minh bạch, an toàn và dễ tiếp cận trong mỗi giao dịch.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {/* Feature 1 */}
            <div className="rounded-2xl bg-white border border-slate-200 p-8 shadow-sm hover:shadow-lg transition">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-blue-100 mb-4">
                <span className="text-xl">🔒</span>
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Hoàn toàn minh bạch</h3>
              <p className="text-slate-600">
                Tất cả giao dịch được ghi lại trên blockchain. Có thể nhìn rõ ràng nơi mỗi khoản quyên góp đi đến.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="rounded-2xl bg-white border border-slate-200 p-8 shadow-sm hover:shadow-lg transition">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-blue-100 mb-4">
                <span className="text-xl">⚡</span>
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Cập nhật theo thời gian thực</h3>
              <p className="text-slate-600">
                Xem tiến trình chiến dịch ngay lập tức. Không trễ, không trung gian. Trực tiếp từ blockchain lên màn hình của bạn.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="rounded-2xl bg-white border border-slate-200 p-8 shadow-sm hover:shadow-lg transition">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-blue-100 mb-4">
                <span className="text-xl">🌍</span>
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Toàn cầu & dễ tiếp cận</h3>
              <p className="text-slate-600">
                Không có giới hạn địa lý. Bất kỳ ai có ví điện tử đều có thể tham gia tài trợ chiến dịch trên toàn thế giới.
              </p>
            </div>
          </div>
        </section>

        {/* Featured Campaigns Section */}
        <section className="flex flex-col gap-8">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900">Chiến dịch nổi bật</h2>
              <p className="text-lg text-slate-600 mt-2">
                Khám phá các chiến dịch đang hoạt động tạo ra tác động thực sự trên blockchain
              </p>
            </div>
            <Link
              href="/campaigns"
              className="inline-flex items-center justify-center px-6 py-3 rounded-lg border-2 border-slate-200 text-slate-900 font-semibold hover:border-blue-600 hover:text-blue-600 transition duration-200 w-fit"
            >
              Xem tất cả →
            </Link>
          </div>
          <div className="mt-4">
            <CampaignListDisplay />
          </div>
        </section>

        {/* How It Works Section */}
        <section id="about" className="flex flex-col gap-8">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
              Nó hoạt động như thế nào
            </h2>
            <p className="text-lg text-slate-600">
              Quy trình 4 bước đơn giản để khởi chạy hoặc hỗ trợ một chiến dịch
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-4">
            {/* Step 1 */}
            <div className="flex flex-col gap-4">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-600 text-white font-bold text-lg">
                1
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Kết nối ví</h3>
                <p className="text-slate-600 text-sm mt-2">
                  Liên kết ví MetaMask hoặc ví ưa thích của bạn để bắt đầu trên mạng thử nghiệm Sepolia
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex flex-col gap-4">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-600 text-white font-bold text-lg">
                2
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Tạo chiến dịch</h3>
                <p className="text-slate-600 text-sm mt-2">
                  Đặt mục tiêu quyên góp, thời hạn và chi tiết chiến dịch trên chuỗi khối
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex flex-col gap-4">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-600 text-white font-bold text-lg">
                3
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Chia sẻ & quyên góp</h3>
                <p className="text-slate-600 text-sm mt-2">
                  Quảng bá chiến dịch của bạn và theo dõi quyên góp theo thời gian thực trên blockchain
                </p>
              </div>
            </div>

            {/* Step 4 */}
            <div className="flex flex-col gap-4">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-600 text-white font-bold text-lg">
                4
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Rút tiền</h3>
                <p className="text-slate-600 text-sm mt-2">
                  An toàn rút tiền quyên góp khi đạt được mục tiêu của bạn
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Network Info & About Section */}
        <section className="flex flex-col gap-8 rounded-2xl bg-white border border-slate-200 p-8 md:p-10">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
              Được xây dựng trên Ethereum Sepolia
            </h2>
            <p className="text-lg text-slate-600">
              Nền tảng của chúng tôi chạy trên mạng thử nghiệm Ethereum Sepolia. Mỗi chiến dịch, quyên góp và cột mốc được ghi lại vĩnh viễn trên blockchain để đảm bảo minh bạch hoàn toàn.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <div className="flex flex-col gap-2">
              <p className="text-sm font-semibold text-slate-600">Mạng</p>
              <p className="text-xl font-bold text-slate-900">Ethereum Sepolia</p>
              <p className="text-sm text-slate-600">Mạng thử nghiệm để phát triển và kiểm tra</p>
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-sm font-semibold text-slate-600">ID chuỗi</p>
              <p className="text-xl font-bold text-slate-900">11155111</p>
              <p className="text-sm text-slate-600">Định danh mạng duy nhất</p>
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-sm font-semibold text-slate-600">Công nghệ</p>
              <p className="text-xl font-bold text-slate-900">Hợp đồng thông minh</p>
              <p className="text-sm text-slate-600">Tự động hóa dựa trên Solidity</p>
            </div>
          </div>
        </section>

        {/* Final CTA Section */}
        <section className="rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 px-8 py-12 text-white text-center md:px-12 shadow-lg">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Sẵn sàng tạo ra sự thay đổi?
          </h2>
          <p className="text-lg text-blue-100 mb-8 max-w-xl mx-auto">
            Bắt đầu một chiến dịch, hỗ trợ một mục đích, hoặc theo dõi đóng góp của bạn trên blockchain. Tham gia cộng đồng của chúng tôi hôm nay.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {safeIsConnected && safeIsSepoliaNetwork ? (
              <Link
                href="/campaigns/create"
                className="inline-flex items-center justify-center px-8 py-3 rounded-lg bg-white text-blue-600 font-bold hover:bg-blue-50 transition duration-200 shadow-lg"
              >
                Bắt đầu một chiến dịch
              </Link>
            ) : (
              <button
                className="inline-flex items-center justify-center px-8 py-3 rounded-lg bg-white/30 text-white font-bold cursor-not-allowed"
                disabled
                title={!isConnected ? "Kết nối ví để tạo chiến dịch" : "Chuyển sang mạng Sepolia"}
              >
                Bắt đầu một chiến dịch
              </button>
            )}
            <Link
              href="/campaigns"
              className="inline-flex items-center justify-center px-8 py-3 rounded-lg border-2 border-white text-white font-bold hover:bg-white/10 transition duration-200"
            >
              Duyệt chiến dịch
            </Link>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-slate-200 pt-12 pb-8">
          <div className="grid gap-8 md:grid-cols-4 mb-8">
            {/* Brand Column */}
            <div className="flex flex-col gap-2">
              <p className="text-lg font-bold text-slate-900">FundRaising</p>
              <p className="text-sm text-slate-600">
                Quyên góp phi tập trung được hỗ trợ bởi công nghệ blockchain.
              </p>
            </div>

            {/* Navigation Column */}
            <div className="flex flex-col gap-3">
              <p className="text-sm font-semibold text-slate-900">Nền tảng</p>
              <Link href="/campaigns" className="text-sm text-slate-600 hover:text-blue-600 transition">
                Duyệt chiến dịch
              </Link>
              <Link href="/campaigns/create" className="text-sm text-slate-600 hover:text-blue-600 transition">
                Tạo chiến dịch
              </Link>
              <Link href="/donations" className="text-sm text-slate-600 hover:text-blue-600 transition">
                Quyên góp của tôi
              </Link>
              <Link href="/status" className="text-sm text-slate-600 hover:text-blue-600 transition">
                Trạng thái hệ thống
              </Link>
            </div>

            {/* Network Column */}
            <div className="flex flex-col gap-3">
              <p className="text-sm font-semibold text-slate-900">Mạng</p>
              <a href="https://sepolia.etherscan.io" target="_blank" rel="noopener noreferrer" className="text-sm text-slate-600 hover:text-blue-600 transition">
                Trình khám phá Sepolia
              </a>
              <a href="https://faucet.sepolia.dev" target="_blank" rel="noopener noreferrer" className="text-sm text-slate-600 hover:text-blue-600 transition">
                Lấy ETH thử nghiệm
              </a>
            </div>

            {/* Info Column */}
            <div className="flex flex-col gap-3">
              <p className="text-sm font-semibold text-slate-900">Về chúng tôi</p>
              <p className="text-sm text-slate-600">
                Được xây dựng cho IE213 - Khóa học Công nghệ Phát triển Web tại UIT
              </p>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-8">
            <div className="flex flex-col md:flex-row gap-4 justify-between items-center text-sm text-slate-600">
              <p>© 2024 FundRaising. Bảo lưu mọi quyền.</p>
              <div className="flex gap-6">
                <a href="#" className="hover:text-blue-600 transition">Riêng tư</a>
                <a href="#" className="hover:text-blue-600 transition">Điều khoản</a>
                <a href="#" className="hover:text-blue-600 transition">Liên hệ</a>
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
