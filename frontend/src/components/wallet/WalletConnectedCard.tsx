'use client';

interface WalletConnectedCardProps {
  address: string;
  isSepoliaNetwork: boolean;
  authRole: string | null;
  onDisconnect: () => void;
  isDisconnecting?: boolean;
  onSwitchToSepolia?: () => void;
  isSwitchingNetwork?: boolean;
  displayName?: string | null;
  avatarUrl?: string | null;
}

function shortenAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function getInitial(displayName: string | null | undefined, address: string) {
  if (displayName && displayName.trim().length > 0) {
    return displayName.trim().charAt(0).toUpperCase();
  }
  return address.charAt(2).toUpperCase();
}

/**
 * UI-only component for connected wallet state.
 */
export default function WalletConnectedCard({
  address,
  isSepoliaNetwork,
  authRole,
  onDisconnect,
  isDisconnecting,
  onSwitchToSepolia,
  isSwitchingNetwork,
  displayName,
  avatarUrl,
}: WalletConnectedCardProps) {
  const primaryLabel = displayName && displayName.trim().length > 0 ? displayName.trim() : shortenAddress(address);

  return (
    <div className="flex items-center gap-2">
      <div
        className={`wallet-pill inline-flex items-center gap-2 rounded-full border px-3 py-2 ${
          isSepoliaNetwork
            ? 'border-[rgba(16,185,129,0.35)]'
            : 'border-amber-500/40'
        }`}
      >
        <span
          className={`h-2 w-2 rounded-full ${isSepoliaNetwork ? 'bg-[var(--accent-green)]' : 'bg-amber-500'}`}
          aria-hidden
        />
        <div className="flex items-center gap-2">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={primaryLabel}
              className="h-6 w-6 rounded-full border border-[rgba(99,102,241,0.3)] bg-[var(--bg-card)] object-cover"
            />
          ) : (
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--gradient-hero)] text-[11px] font-bold text-white">
              {getInitial(displayName, address)}
            </div>
          )}
          <div className="flex flex-col leading-tight">
            <span className="max-w-[120px] truncate text-xs font-semibold text-[var(--text-primary)]">
              {primaryLabel}
            </span>
            <span className="font-mono-data hidden text-[10px] text-[var(--accent-cyan)] sm:inline">
              {shortenAddress(address)}
            </span>
          </div>
        </div>
        {authRole && <span className="hidden text-xs text-[var(--text-secondary)] md:inline">({authRole})</span>}
      </div>

      {!isSepoliaNetwork && onSwitchToSepolia && (
        <button
          onClick={onSwitchToSepolia}
          disabled={isSwitchingNetwork}
          className="rounded-full bg-[var(--accent-primary)] px-3 py-2 text-xs font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSwitchingNetwork ? 'Đang chuyển...' : 'Đổi Sepolia'}
        </button>
      )}

      <button
        onClick={onDisconnect}
        disabled={Boolean(isDisconnecting)}
        className="btn-disconnect-pill px-4 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isDisconnecting ? 'Đang ngắt...' : 'Ngắt'}
      </button>
    </div>
  );
}
