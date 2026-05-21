'use client';

import { useChainId, useAccount, useSwitchChain } from 'wagmi';
import { SEPOLIA_CHAIN_ID } from '@/lib/contracts/config';

export function NetworkAccessGuard() {
  const { isConnected, chain, chainId: accountChainId } = useAccount();
  const fallbackChainId = useChainId();
  const { switchChain, isPending } = useSwitchChain();
  const resolvedChainId =
    typeof accountChainId === 'number' ? accountChainId : fallbackChainId;

  if (!isConnected) return null;
  if (resolvedChainId === SEPOLIA_CHAIN_ID) return null;

  const currentNetworkLabel =
    chain?.name || `Chain #${resolvedChainId || 'unknown'}`;

  return (
    <div className="fixed inset-0 z-95 bg-slate-950/55 backdrop-blur-[2px]">
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-lg rounded-2xl border-2 border-red-400 bg-white p-6 shadow-2xl sm:p-8">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-red-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-red-800">
            Sai mạng
          </div>
          <h2 className="text-xl font-extrabold text-slate-900 sm:text-2xl">
            Vui lòng chuyển sang Sepolia
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-700 sm:text-base">
            Bạn đang kết nối vào <span className="font-semibold">{currentNetworkLabel}</span>.
            Ứng dụng chỉ cho phép thao tác trên mạng <span className="font-semibold">Sepolia</span>.
          </p>

          <div className="mt-6">
            <button
              type="button"
              onClick={() => switchChain({ chainId: SEPOLIA_CHAIN_ID })}
              disabled={isPending}
              className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl bg-red-600 px-5 py-3 text-sm font-bold text-white shadow-lg transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? 'Đang chuyển mạng...' : 'Chuyển sang Sepolia'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
