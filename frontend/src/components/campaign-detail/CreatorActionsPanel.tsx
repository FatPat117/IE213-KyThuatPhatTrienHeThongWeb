'use client';

interface CreatorActionsPanelProps {
  visible: boolean;
  isPending: boolean;
  isConfirming: boolean;
  isWithdrawn: boolean;
  isConfirmed: boolean;
  txHash?: string;
  errorMessage?: string | null;
  onWithdraw: () => void;
}

/**
 * Actions for campaign creator/beneficiary after campaign completion.
 */
export default function CreatorActionsPanel({
  visible,
  isPending,
  isConfirming,
  isWithdrawn,
  isConfirmed,
  txHash,
  errorMessage,
  onWithdraw,
}: CreatorActionsPanelProps) {
  if (!visible) return null;

  return (
    <div className="rounded-2xl bg-gradient-to-br from-purple-600 to-purple-700 p-8 shadow-xl text-white">
      <h3 className="text-2xl font-bold mb-2">Hành động của chủ chiến dịch</h3>
      <p className="text-purple-100 mb-6 text-sm">Chiến dịch đã kết thúc. Thực hiện rút tiền gây quỹ.</p>

      <button
        onClick={onWithdraw}
        disabled={isPending || isConfirming || isWithdrawn}
        className="w-full rounded-lg bg-white text-purple-600 px-6 py-4 text-lg font-bold shadow-lg hover:bg-purple-50 transition disabled:cursor-not-allowed disabled:opacity-50 mb-4"
      >
        {isPending
          ? '⏳ Đợi xác nhận từ ví...'
          : isConfirming
            ? '🔄 Đang xác nhận...'
            : isWithdrawn
              ? '✓ Đã rút'
              : '💰 Rút tiền'}
      </button>

      {isConfirmed && txHash && (
        <div className="rounded-lg bg-green-500 px-4 py-3 text-sm font-medium text-white">
          ✓ Rút tiền thành công!
        </div>
      )}
      {errorMessage && (
        <div className="rounded-lg bg-red-500 px-4 py-3 text-sm font-medium text-white">⚠️ {errorMessage}</div>
      )}
      {txHash && (
        <a
          className="block text-center text-sm font-medium text-purple-100 hover:text-white hover:underline mt-3"
          href={`https://sepolia.etherscan.io/tx/${txHash}`}
          target="_blank"
          rel="noreferrer"
        >
          Xem trên Etherscan →
        </a>
      )}
    </div>
  );
}
