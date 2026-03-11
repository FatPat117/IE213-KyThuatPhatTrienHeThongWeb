'use client';

interface WalletConnectedCardProps {
  address: string;
  isSepoliaNetwork: boolean;
  authRole: string | null;
  onDisconnect: () => void;
  onSwitchToSepolia?: () => void;
  isSwitchingNetwork?: boolean;
}

function shortenAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
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
}: WalletConnectedCardProps) {
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
        <span className="text-xs text-slate-600 hidden sm:inline">Ví:</span>
        <span className="text-sm font-mono font-semibold text-slate-900">{shortenAddress(address)}</span>
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
