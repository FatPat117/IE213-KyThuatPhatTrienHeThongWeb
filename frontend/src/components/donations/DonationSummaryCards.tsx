'use client';

interface DonationSummaryCardsProps {
  wallet: string;
  donationCount: number;
  totalEth: string;
  campaignCount?: number;
}

const DONATION_CAP_ETH = 1;
const CAMPAIGN_CAP = 10;

/**
 * Summary section for donor dashboard with optional progress bars.
 */
export default function DonationSummaryCards({
  wallet,
  donationCount,
  totalEth,
  campaignCount = 0,
}: DonationSummaryCardsProps) {
  const totalEthNum = parseFloat(totalEth) || 0;
  const donationProgress = Math.min((totalEthNum / DONATION_CAP_ETH) * 100, 100);
  const campaignProgress = Math.min((campaignCount / CAMPAIGN_CAP) * 100, 100);

  return (
    <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-3">
      <div className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm ring-1 ring-slate-900/5">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Ví đang kết nối</p>
        <code className="text-sm font-mono font-semibold text-slate-900">
          {wallet.slice(0, 6)}...{wallet.slice(-4)}
        </code>
      </div>
      <div className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm ring-1 ring-slate-900/5">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Tổng quyên góp</p>
        <p className="text-2xl font-bold text-emerald-600">{totalEth} ETH</p>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all duration-500"
            style={{ width: `${donationProgress}%` }}
          />
        </div>
        <p className="mt-1 text-xs text-slate-500">{donationCount} lần quyên góp</p>
      </div>
      <div className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm ring-1 ring-slate-900/5">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Chiến dịch đã tạo</p>
        <p className="text-2xl font-bold text-slate-900">{campaignCount}</p>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-indigo-500 transition-all duration-500"
            style={{ width: `${campaignProgress}%` }}
          />
        </div>
        <p className="mt-1 text-xs text-slate-500">trên hệ thống</p>
      </div>
    </div>
  );
}
