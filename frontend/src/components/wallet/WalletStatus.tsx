'use client';

import { useAccount, useChainId, useBalance } from 'wagmi';
import { formatUnits } from 'viem';

export default function WalletStatus() {
  const SEPOLIA_CHAIN_ID = 11155111;
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { data: balance } = useBalance({
    address: address as `0x${string}` | undefined,
    chainId: SEPOLIA_CHAIN_ID,
  });
  const isSepoliaNetwork = chainId === SEPOLIA_CHAIN_ID;
  const hasProvider =
    typeof window !== 'undefined' && Boolean((window as Window & { ethereum?: unknown }).ethereum);

  if (!isConnected) {
    return (
      <div className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg space-y-2">
        <p className="text-gray-700 text-sm font-semibold">Chế độ xem (read-only)</p>
        <p className="text-gray-600 text-xs">
          {hasProvider
            ? 'Bạn có thể xem dữ liệu on-chain mà không cần kết nối ví.'
            : 'Chưa có MetaMask. Bạn vẫn có thể xem dữ liệu on-chain.'}
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
              {shortenAddress(address)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-600 mb-1">Số dư</p>
            <p className="font-mono text-sm font-bold text-blue-700">
              {balance
                ? `${parseFloat(formatUnits(balance.value, balance.decimals)).toFixed(4)} ${balance.symbol}`
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
