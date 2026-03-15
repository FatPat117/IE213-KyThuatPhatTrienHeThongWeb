'use client';

import { formatEther } from 'viem';

export interface TransactionItem {
  txHash: string;
  campaignId?: number;
  campaignName?: string;
  amountWei?: string;
  timestamp?: number;
  status?: 'pending' | 'success' | 'failed';
}

function formatWeiToEth(wei: string) {
  try {
    return Number(formatEther(BigInt(wei))).toFixed(4);
  } catch {
    return '0.0000';
  }
}

interface TransactionHistoryModalProps {
  open: boolean;
  title?: string;
  transactions: TransactionItem[];
  onClose: () => void;
}

function getStatusStyles(status?: 'pending' | 'success' | 'failed') {
  if (status === 'success') return 'bg-green-100 text-green-700';
  if (status === 'failed') return 'bg-red-100 text-red-700';
  return 'bg-yellow-100 text-yellow-700';
}

function getStatusLabel(status?: 'pending' | 'success' | 'failed') {
  if (status === 'success') return 'success';
  if (status === 'failed') return 'failed';
  return 'pending';
}

export default function TransactionHistoryModal({
  open,
  title = 'Transaction History',
  transactions,
  onClose,
}: TransactionHistoryModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/60 p-4">
      <div className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h3 className="text-lg font-bold text-slate-900">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Đóng
          </button>
        </div>

        <div className="max-h-[70vh] space-y-3 overflow-y-auto p-6">
          {transactions.length === 0 && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-600">
              Chưa có giao dịch để hiển thị.
            </div>
          )}

          {transactions.map((tx, index) => (
            <div key={`${tx.txHash}-${index}`} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900">
                  {tx.campaignName || `Campaign #${tx.campaignId ?? '-'}`}
                </p>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusStyles(tx.status)}`}>
                  {getStatusLabel(tx.status)}
                </span>
              </div>

              <div className="space-y-1 text-xs text-slate-600">
                {tx.amountWei !== undefined && (
                  <p>
                    Amount: <span className="font-semibold text-slate-800">{formatWeiToEth(tx.amountWei)} ETH</span>
                  </p>
                )}
                {tx.timestamp && <p>Time: {new Date(tx.timestamp).toLocaleString('vi-VN')}</p>}
                <p className="break-all">
                  Tx: <span className="font-mono text-slate-800">{tx.txHash}</span>
                </p>
              </div>

              <a
                href={`https://sepolia.etherscan.io/tx/${tx.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex text-xs font-semibold text-blue-600 hover:text-blue-700"
              >
                Xem trên Etherscan →
              </a>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
