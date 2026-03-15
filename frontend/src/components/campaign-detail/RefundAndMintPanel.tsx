'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

interface RefundAndMintPanelProps {
  showRefund: boolean;
  showMint: boolean;
  refundPending: boolean;
  refundConfirming: boolean;
  refundConfirmed: boolean;
  refundHash?: string;
  refundError?: string | null;
  mintPending: boolean;
  mintConfirming: boolean;
  mintConfirmed: boolean;
  mintHash?: string;
  mintError?: string | null;
  mintProfileSaving?: boolean;
  defaultDisplayName?: string;
  onRefund: () => void;
  onMint: (displayName: string) => void;
}

/**
 * Donor-only action cards for refund and certificate minting.
 */
export default function RefundAndMintPanel({
  showRefund,
  showMint,
  refundPending,
  refundConfirming,
  refundConfirmed,
  refundHash,
  refundError,
  mintPending,
  mintConfirming,
  mintConfirmed,
  mintHash,
  mintError,
  mintProfileSaving = false,
  defaultDisplayName = '',
  onRefund,
  onMint,
}: RefundAndMintPanelProps) {
  const [showMintPrompt, setShowMintPrompt] = useState(false);
  const [displayNameInput, setDisplayNameInput] = useState(defaultDisplayName);

  useEffect(() => {
    if (!showMintPrompt) {
      setDisplayNameInput(defaultDisplayName);
    }
  }, [defaultDisplayName, showMintPrompt]);

  const handleConfirmMint = () => {
    const normalized = displayNameInput.trim();
    if (!normalized) return;
    onMint(normalized);
    setShowMintPrompt(false);
  };

  return (
    <>
      {showRefund && (
        <div className="rounded-2xl bg-gradient-to-br from-orange-600 to-orange-700 p-8 shadow-xl text-white">
          <h3 className="text-2xl font-bold mb-2">Chiến dịch không đạt mục tiêu</h3>
          <p className="text-orange-100 mb-6 text-sm">Bạn có thể yêu cầu hoàn tiền.</p>
          <button
            onClick={onRefund}
            disabled={refundPending || refundConfirming}
            className="w-full rounded-lg bg-white text-orange-600 px-6 py-4 text-lg font-bold shadow-lg hover:bg-orange-50 transition disabled:cursor-not-allowed disabled:opacity-50 mb-4"
          >
            {refundPending ? '⏳ Đợi xác nhận từ ví...' : refundConfirming ? '🔄 Đang xác nhận...' : '🔙 Yêu cầu hoàn tiền'}
          </button>
          {refundConfirmed && refundHash && (
            <div className="rounded-lg bg-green-500 px-4 py-3 text-sm font-medium text-white">
              ✓ Hoàn tiền thành công! Vui lòng kiểm tra ví.
            </div>
          )}
          {refundError && (
            <div className="rounded-lg bg-red-500 px-4 py-3 text-sm font-medium text-white">⚠️ {refundError}</div>
          )}
        </div>
      )}

      {showMint && (
        <div className="rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-700 p-8 shadow-xl text-white">
          <h3 className="text-2xl font-bold mb-2">NFT chứng nhận quyên góp</h3>
          <p className="text-emerald-100 mb-6 text-sm">Bạn có thể mint certificate NFT on-chain.</p>
          <button
            onClick={() => setShowMintPrompt(true)}
            disabled={mintPending || mintConfirming || mintProfileSaving}
            className="w-full rounded-lg bg-white text-emerald-700 px-6 py-4 text-lg font-bold shadow-lg hover:bg-emerald-50 transition disabled:cursor-not-allowed disabled:opacity-50"
          >
            {mintProfileSaving
              ? '💾 Đang lưu hồ sơ...'
              : mintPending
                ? '⏳ Đợi xác nhận từ ví...'
                : mintConfirming
                  ? '🔄 Đang xác nhận...'
                  : '🎖️ Mint Certificate'}
          </button>
          {showMintPrompt && (
            <div className="mt-4 rounded-xl border border-emerald-200 bg-white/95 p-4 text-emerald-900">
              <p className="text-sm font-semibold">Tên hiển thị trên chứng chỉ</p>
              <p className="mt-1 text-xs text-emerald-800/90">
                Tên này sẽ được lưu vào hồ sơ của bạn trước khi mint NFT.
              </p>
              <input
                type="text"
                value={displayNameInput}
                onChange={(event) => setDisplayNameInput(event.target.value)}
                placeholder="Nhập tên hiển thị của bạn"
                maxLength={100}
                className="mt-3 w-full rounded-lg border border-emerald-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowMintPrompt(false)}
                  className="rounded-lg border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-900 hover:bg-emerald-50"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleConfirmMint}
                  disabled={!displayNameInput.trim() || mintProfileSaving || mintPending || mintConfirming}
                  className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Xác nhận và mint
                </button>
              </div>
            </div>
          )}
          {mintConfirmed && mintHash && (
            <>
              <div className="rounded-lg bg-green-500 px-4 py-3 text-sm font-medium text-white mt-4">
                ✓ Mint certificate thành công!
              </div>
              <Link
                href="/certificates"
                className="mt-3 inline-flex w-full items-center justify-center rounded-lg bg-white/15 px-4 py-3 text-sm font-semibold text-white hover:bg-white/20 transition"
              >
                Xem chứng chỉ của tôi →
              </Link>
            </>
          )}
          {mintError && (
            <div className="rounded-lg bg-red-500 px-4 py-3 text-sm font-medium text-white mt-4">⚠️ {mintError}</div>
          )}
        </div>
      )}
    </>
  );
}
