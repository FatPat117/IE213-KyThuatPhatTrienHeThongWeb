'use client';

import { useAccount } from 'wagmi';

const SEPOLIA_CHAIN_ID = 11155111;

export default function NetworkBadge() {
  const { isConnected, chain } = useAccount();

  if (!isConnected) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
        Read-only
      </span>
    );
  }

  if (chain?.id === SEPOLIA_CHAIN_ID) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700">
        <span className="h-1.5 w-1.5 rounded-full bg-green-600" />
        Sepolia
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700">
      <span className="h-1.5 w-1.5 rounded-full bg-red-600" />
      Wrong Network
    </span>
  );
}
