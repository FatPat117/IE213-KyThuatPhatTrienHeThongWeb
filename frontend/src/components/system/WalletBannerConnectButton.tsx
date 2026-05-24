'use client';

import { useEffect, useState } from 'react';
import { useConnect } from 'wagmi';
import {
  getWalletErrorMessage,
  isWalletUserRejectedMessage,
} from '@/lib/errors/normalize';
import { showErrorToast } from '@/lib/ui/toast';

const isIgnorableConnectorError = (message: string) => {
  return message.toLowerCase().includes('connector not connected');
};

type Props = {
  className?: string;
};

/**
 * Nút kết nối ví trên banner "Ví chưa kết nối" — cùng luồng injected connector như header.
 */
export function WalletBannerConnectButton({ className = '' }: Props) {
  const { connect, connectors, isPending } = useConnect();
  const [hasProvider, setHasProvider] = useState<boolean | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setHasProvider(Boolean((window as { ethereum?: unknown }).ethereum));
    }
  }, []);

  const handleClick = async () => {
    try {
      if (hasProvider === false) {
        window.open('https://metamask.io/download/', '_blank');
        return;
      }
      if (hasProvider === null) {
        const providerExists = Boolean(
          (window as { ethereum?: unknown }).ethereum,
        );
        setHasProvider(providerExists);
        if (!providerExists) {
          window.open('https://metamask.io/download/', '_blank');
          return;
        }
      }
      const injected =
        connectors.find((c) => c.id === 'injected') ?? connectors[0];
      if (!injected) {
        showErrorToast(
          'Không tìm thấy connector ví. Vui lòng tải lại trang.',
          { durationMs: 6000 },
        );
        return;
      }
      await connect({ connector: injected });
    } catch (error) {
      console.error('[WalletBannerConnectButton]', error);
      const rawMessage = error instanceof Error ? error.message : '';
      if (isIgnorableConnectorError(rawMessage)) return;
      const normalizedMessage = getWalletErrorMessage(error, {
        fallback: 'Kết nối ví thất bại. Vui lòng thử lại.',
      });
      showErrorToast(normalizedMessage, {
        emphasis: !isWalletUserRejectedMessage(normalizedMessage),
      });
    }
  };

  return (
    <button
      type="button"
      onClick={() => void handleClick()}
      disabled={isPending}
      className={`pointer-events-auto inline-flex min-h-[44px] items-center justify-center rounded-xl border-2 border-amber-900/20 bg-linear-to-b from-amber-600 to-amber-700 px-5 py-2.5 text-sm font-bold text-white shadow-[0_6px_20px_-4px_rgba(146,64,14,0.65)] ring-2 ring-white/90 transition hover:from-amber-500 hover:to-amber-600 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-70 sm:min-h-0 sm:px-6 sm:py-3 sm:text-base ${className}`}
    >
      {isPending ? 'Đang kết nối…' : 'Kết nối ví'}
    </button>
  );
}
