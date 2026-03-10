'use client';

interface WalletConnectedCardProps {
  address: string;
  isSepoliaNetwork: boolean;
  authRole: string | null;
  onDisconnect: () => void;
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
}: WalletConnectedCardProps) {
  return (
    <div className="flex flex-col gap-2 max-w-xs">
      <div
        className={`px-4 py-3 rounded-lg border ${
          isSepoliaNetwork ? 'bg-green-50 border-green-300' : 'bg-yellow-50 border-yellow-300'
        }`}
      >
        <p className="text-xs text-gray-700 mb-1">Ví đã kết nối:</p>
        <p className="text-sm font-mono font-bold text-gray-900 break-all">{shortenAddress(address)}</p>
        {authRole && <p className="text-xs text-gray-600 mt-1">SIWE role: {authRole}</p>}
      </div>

      {!isSepoliaNetwork && (
        <div className="px-4 py-3 bg-red-50 border border-red-300 rounded-lg">
          <p className="text-sm font-semibold text-red-900 mb-2">⚠️ Mạng lưới sai</p>
          <button
            onClick={() => window.open('https://chainlist.org/?search=sepolia', '_blank')}
            className="inline-flex items-center justify-center px-3 py-2 rounded-md bg-red-600 text-white text-xs font-semibold hover:bg-red-700 transition"
          >
            Hướng dẫn chuyển mạng
          </button>
        </div>
      )}

      <button
        onClick={onDisconnect}
        className="px-6 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors text-sm"
      >
        Ngắt kết nối
      </button>
    </div>
  );
}
