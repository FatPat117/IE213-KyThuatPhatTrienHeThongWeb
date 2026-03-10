'use client';

interface DonationSummaryCardsProps {
  wallet: string;
  donationCount: number;
  totalEth: string;
}

/**
 * Summary section for donor dashboard.
 */
export default function DonationSummaryCards({
  wallet,
  donationCount,
  totalEth,
}: DonationSummaryCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <p className="text-sm font-medium text-slate-600 mb-2">Ví đang kết nối</p>
        <code className="text-sm font-mono text-slate-900">
          {wallet.slice(0, 6)}...{wallet.slice(-4)}
        </code>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <p className="text-sm font-medium text-slate-600 mb-2">Số lần quyên góp</p>
        <p className="text-2xl font-bold text-slate-900">{donationCount}</p>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <p className="text-sm font-medium text-slate-600 mb-2">Tổng số tiền</p>
        <p className="text-2xl font-bold text-green-600">{totalEth} ETH</p>
      </div>
    </div>
  );
}
