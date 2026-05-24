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
        className="rounded-full bg-[var(--gradient-hero)] px-6 py-2.5 text-sm font-semibold text-white shadow-[0_0_16px_rgba(99,102,241,0.35)] transition hover:scale-[1.02] hover:shadow-[0_0_24px_rgba(99,102,241,0.5)] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
      >
        {isPending ? 'Đang xử lý...' : buttonLabel ?? 'Kết nối ví'}
      </button>
    </div>
  );
}
