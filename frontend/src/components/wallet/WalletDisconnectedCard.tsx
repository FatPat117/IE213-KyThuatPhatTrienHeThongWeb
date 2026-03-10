'use client';

interface WalletDisconnectedCardProps {
  isPending: boolean;
  errorMessage: string | null;
  onConnect: () => void;
}

/**
 * UI-only component for the disconnected wallet state.
 */
export default function WalletDisconnectedCard({
  isPending,
  errorMessage,
  onConnect,
}: WalletDisconnectedCardProps) {
  return (
    <div className="flex flex-col gap-3 max-w-xs">
      <button
        onClick={onConnect}
        disabled={isPending}
        className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors"
      >
        {isPending ? 'Đang kết nối...' : 'Kết nối ví'}
      </button>
      {errorMessage && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
          ⚠️ {errorMessage}
        </div>
      )}
    </div>
  );
}
