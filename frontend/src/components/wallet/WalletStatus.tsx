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
  
  if (!safeIsConnected) {
    return (
      <div className="space-y-2 rounded-lg border border-[var(--border-glow)] bg-[rgba(99,102,241,0.06)] px-4 py-3">
        <p className="text-sm font-semibold text-[var(--text-primary)]">Chế độ xem (read-only)</p>
        <p className="text-xs text-[var(--text-secondary)]">
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
      <div className="rounded-lg border border-[rgba(99,102,241,0.25)] bg-[rgba(99,102,241,0.08)] px-4 py-3">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="mb-1 text-xs text-[var(--text-secondary)]">Địa chỉ</p>
            <p className="font-mono-data text-sm font-bold text-[var(--accent-cyan)]">
              {shortenAddress(safeAddress)}
            </p>
          </div>
          <div>
            <p className="mb-1 text-xs text-[var(--text-secondary)]">Số dư</p>
            <p className="font-mono-data text-sm font-bold text-[var(--accent-cyan)]">
              {safeBalance
                ? `${parseFloat(formatUnits(safeBalance.value, safeBalance.decimals)).toFixed(4)} ${safeBalance.symbol}`
                : '0 ETH'}
            </p>
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <div className={`flex-1 rounded-full px-3 py-2 text-center text-xs font-semibold ${
          isSepoliaNetwork
            ? 'badge-sepolia-glow border border-[rgba(16,185,129,0.4)] bg-[rgba(16,185,129,0.12)] text-[var(--accent-green)]'
            : 'border border-red-500/40 bg-red-500/10 text-red-300'
        }`}>
          {isSepoliaNetwork ? '✓ Sepolia' : '✗ Sai mạng'}
        </div>
      </div>
    </div>
  );
}
