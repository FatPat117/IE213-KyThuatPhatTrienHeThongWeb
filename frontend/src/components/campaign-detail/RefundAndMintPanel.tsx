'use client';

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
  onRefund: () => void;
  onMint: () => void;
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
  onRefund,
  onMint,
}: RefundAndMintPanelProps) {
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
            onClick={onMint}
            disabled={mintPending || mintConfirming}
            className="w-full rounded-lg bg-white text-emerald-700 px-6 py-4 text-lg font-bold shadow-lg hover:bg-emerald-50 transition disabled:cursor-not-allowed disabled:opacity-50"
          >
            {mintPending ? '⏳ Đợi xác nhận từ ví...' : mintConfirming ? '🔄 Đang xác nhận...' : '🎖️ Mint Certificate'}
          </button>
          {mintConfirmed && mintHash && (
            <div className="rounded-lg bg-green-500 px-4 py-3 text-sm font-medium text-white mt-4">
              ✓ Mint certificate thành công!
            </div>
          )}
          {mintError && (
            <div className="rounded-lg bg-red-500 px-4 py-3 text-sm font-medium text-white mt-4">⚠️ {mintError}</div>
          )}
        </div>
      )}
    </>
  );
}
