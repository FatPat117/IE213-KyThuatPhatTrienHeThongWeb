'use client';

interface WalletDisconnectedCardProps {
  isPending: boolean;
  onConnect: () => void;
  buttonLabel?: string;
}

/**
 * UI-only component for the disconnected wallet state.
 */
export default function WalletDisconnectedCard({
  isPending,
  onConnect,
  buttonLabel,
}: WalletDisconnectedCardProps) {
  return (
    <div className="flex flex-col gap-3 max-w-xs">
      <button
        onClick={onConnect}
        disabled={isPending}
        className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors"
      >
        {isPending ? 'Đang xử lý...' : buttonLabel ?? 'Kết nối ví'}
      </button>
    </div>
  );
}
