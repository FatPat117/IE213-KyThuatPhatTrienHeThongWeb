'use client';

import Link from 'next/link';

interface CreateCampaignSuccessCardProps {
  txHash: string;
  etherscanLink: string | null;
  createdCampaignId: number | null;
}

/**
 * Success state card displayed after campaign creation transaction confirms.
 */
export default function CreateCampaignSuccessCard({
  txHash,
  etherscanLink,
  createdCampaignId,
}: CreateCampaignSuccessCardProps) {
  return (
    <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 rounded-2xl p-8 text-center">
      <div className="inline-flex items-center justify-center w-16 h-16 bg-green-500 rounded-full mb-6 shadow-lg">
        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
        </svg>
      </div>

      <h3 className="text-2xl font-bold text-green-900 mb-3">🎉 Tạo chiến dịch thành công!</h3>
      <p className="text-green-800 mb-6">Chiến dịch đã được ghi nhận trên Sepolia và sẵn sàng nhận đóng góp.</p>

      <div className="bg-white rounded-lg p-4 mb-6">
        <p className="text-sm font-medium text-slate-600 mb-1">Mã giao dịch</p>
        <code className="text-xs font-mono text-slate-900 break-all">{txHash}</code>
      </div>

      {etherscanLink && (
        <a
          href={etherscanLink}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition mb-4"
        >
          Xem trên Etherscan
        </a>
      )}

      <div className="flex flex-col items-center justify-center gap-2 text-slate-600">
        {createdCampaignId !== null && (
          <Link
            href={`/campaigns/${createdCampaignId}`}
            className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-slate-900 text-white font-semibold hover:bg-slate-800 transition"
          >
            Xem chiến dịch vừa tạo
          </Link>
        )}
        <div className="flex items-center gap-2">
          <div className="animate-spin h-4 w-4 border-2 border-slate-400 border-t-transparent rounded-full" />
          <p className="text-sm">Đang chuyển hướng...</p>
        </div>
      </div>
    </div>
  );
}
