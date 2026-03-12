'use client';

import Link from 'next/link';
import type { DonationRecord } from '@/lib/api/types';

interface DonationHistoryListProps {
  donations: Array<DonationRecord & {
    status?: 'pending' | 'success' | 'failed';
    campaignTitle?: string;
  }>;
  showDonor?: boolean;
}

function statusStyles(status?: 'pending' | 'success' | 'failed') {
  if (status === 'success') return 'bg-green-100 text-green-700';
  if (status === 'failed') return 'bg-red-100 text-red-700';
  return 'bg-yellow-100 text-yellow-700';
}

function statusLabel(status?: 'pending' | 'success' | 'failed') {
  if (status === 'success') return 'success';
  if (status === 'failed') return 'failed';
  return 'pending';
}

/**
 * Render-only list of donations from backend indexer.
 */
export default function DonationHistoryList({ donations, showDonor = false }: DonationHistoryListProps) {
  return (
    <div className="space-y-4">
      {donations.map((donation) => (
        <div
          key={donation.txHash}
          className="rounded-xl bg-slate-50 border border-slate-200 p-6 hover:bg-slate-100 transition-all duration-200"
        >
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Link
                  href={`/campaigns/${donation.campaignOnChainId}`}
                  className="text-lg font-bold text-slate-900 hover:text-blue-600 transition"
                >
                  {donation.campaignTitle || `Campaign #${donation.campaignOnChainId}`}
                </Link>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyles(donation.status)}`}>
                  {statusLabel(donation.status)}
                </span>
              </div>
              <p className="text-sm text-slate-600 mb-3">
                {new Date(donation.donatedAt).toLocaleString('vi-VN')}
              </p>
              {showDonor && (
                <p className="mb-2 text-xs text-slate-600">
                  Donor: <span className="font-mono">{donation.donorWallet.slice(0, 6)}...{donation.donorWallet.slice(-4)}</span>
                </p>
              )}
              {donation.message?.trim() && (
                <p className="mb-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                  💬 {donation.message}
                </p>
              )}
              <a
                href={`https://sepolia.etherscan.io/tx/${donation.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition"
              >
                Xem giao dịch →
              </a>
            </div>

            <div className="text-right">
              <p className="text-sm font-medium text-slate-600">Số tiền</p>
              <p className="text-2xl font-bold text-green-600">{donation.amountEth.toFixed(4)}</p>
              <p className="text-xs text-slate-500">ETH</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
