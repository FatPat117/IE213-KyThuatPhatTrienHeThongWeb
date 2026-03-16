'use client';

interface WalletConnectedCardProps {
  address: string;
  isSepoliaNetwork: boolean;
  authRole: string | null;
  onDisconnect: () => void;
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
  onSwitchToSepolia,
  isSwitchingNetwork,
  displayName,
  avatarUrl,
}: WalletConnectedCardProps) {
  const primaryLabel = displayName && displayName.trim().length > 0 ? displayName.trim() : shortenAddress(address);

  return (
    <div className="flex items-center gap-2">
      <div
        className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 ${
          isSepoliaNetwork ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'
        }`}
      >
        <span
          className={`h-2 w-2 rounded-full ${isSepoliaNetwork ? 'bg-emerald-500' : 'bg-amber-500'}`}
          aria-hidden
        />
        <div className="flex items-center gap-2">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={primaryLabel}
              className="h-6 w-6 rounded-full object-cover border border-slate-200 bg-white"
            />
          ) : (
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-[11px] font-bold text-white">
              {getInitial(displayName, address)}
            </div>
          )}
          <div className="flex flex-col leading-tight">
            <span className="text-xs font-semibold text-slate-900 max-w-[120px] truncate">
              {primaryLabel}
            </span>
            <span className="text-[10px] font-mono text-slate-500 hidden sm:inline">
              {shortenAddress(address)}
            </span>
          </div>
        </div>
        {authRole && <span className="hidden md:inline text-xs text-slate-500">({authRole})</span>}
      </div>

      {!isSepoliaNetwork && onSwitchToSepolia && (
        <button
          onClick={onSwitchToSepolia}
          disabled={isSwitchingNetwork}
          className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed transition"
        >
          {isSwitchingNetwork ? 'Đang chuyển...' : 'Đổi Sepolia'}
        </button>
      )}

      <button
        onClick={onDisconnect}
        className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700 transition"
      >
        Ngắt
      </button>
    </div>
  );
}
