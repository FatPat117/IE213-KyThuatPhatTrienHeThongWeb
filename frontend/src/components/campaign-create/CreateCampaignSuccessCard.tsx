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
    <div className="text-center">
      <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-full border border-emerald-400/40 bg-emerald-500/15 shadow-[0_0_28px_rgba(16,185,129,0.22)]">
        <svg className="h-8 w-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
        </svg>
      </div>

      <h3 className="mb-3 text-2xl font-bold text-[var(--text-primary)]">Tạo chiến dịch thành công!</h3>
      <p className="mb-6 text-[var(--text-secondary)]">
        Chiến dịch đã được tạo thành công và đang chờ được duyệt.
      </p>

      <div className="form-status-tx-box mb-6 text-left">
        <p className="field-hint mb-1">Mã giao dịch</p>
        <code className="block break-all font-mono text-xs text-slate-200">{txHash}</code>
      </div>

      {etherscanLink && (
        <a
          href={etherscanLink}
          target="_blank"
          rel="noopener noreferrer"
          className="web3-btn-primary mb-4 inline-flex items-center gap-2 rounded-lg px-6 py-3 font-semibold"
        >
          Xem trên Etherscan
        </a>
      )}

      <div className="flex flex-col items-center justify-center gap-3 text-[var(--text-secondary)]">
        {createdCampaignId !== null && (
          <Link
            href={`/campaigns/${createdCampaignId}`}
            className="web3-btn-glass inline-flex items-center justify-center rounded-lg px-6 py-3 font-semibold"
          >
            Xem chiến dịch vừa tạo
          </Link>
        )}
        <p className="text-sm text-[var(--text-secondary)]">Đang chuyển hướng...</p>
      </div>
    </div>
  );
}
