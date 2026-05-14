'use client';

import { useAccount, useChainId, useBalance } from 'wagmi';
import { formatUnits } from 'viem';
import { useIsHydrated } from '@/lib/hooks/use-wallet';

export default function WalletStatus() {
  const SEPOLIA_CHAIN_ID = 11155111;
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { data: balance } = useBalance({
    address: address as `0x${string}` | undefined,
    chainId: SEPOLIA_CHAIN_ID,
  });
  const isHydrated = useIsHydrated();
  const safeIsConnected = isHydrated ? isConnected : false;
  const isSepoliaNetwork = isHydrated ? chainId === SEPOLIA_CHAIN_ID : false;
  const safeAddress = isHydrated ? address : undefined;
  const safeBalance = isHydrated ? balance : undefined;
<<<<<<< HEAD

=======
  
>>>>>>> f9e35ed011401d0ff0c7c0a21eeefb7d08a95ca3
  if (!safeIsConnected) {
    return (
      <div className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg space-y-2">
        <p className="text-gray-700 text-sm font-semibold">Chế độ xem (read-only)</p>
        <p className="text-gray-600 text-xs">
          Bạn có thể xem dữ liệu on-chain mà không cần kết nối ví.
        </p>
      </div>
    );
  }

  const shortenAddress = (addr: string | undefined) => {
    if (!addr) return '';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  return (
    <div className="space-y-3">
      <div className="px-4 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-gray-600 mb-1">Địa chỉ</p>
            <p className="font-mono text-sm font-bold text-blue-700">
              {shortenAddress(safeAddress)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-600 mb-1">Số dư</p>
            <p className="font-mono text-sm font-bold text-blue-700">
              {safeBalance
                ? `${parseFloat(formatUnits(safeBalance.value, safeBalance.decimals)).toFixed(4)} ${safeBalance.symbol}`
                : '0 ETH'}
            </p>
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <div className={`flex-1 px-3 py-2 rounded-lg text-center text-xs font-semibold ${
          isSepoliaNetwork
            ? 'bg-green-100 text-green-800 border border-green-300'
            : 'bg-red-100 text-red-800 border border-red-300'
        }`}>
          {isSepoliaNetwork ? '✓ Sepolia' : '✗ Sai mạng'}
        </div>
      </div>
    </div>
  );
}
