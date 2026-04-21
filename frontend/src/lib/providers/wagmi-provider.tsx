'use client';

import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { WalletTxOverlayProvider } from '@/context/wallet-tx-overlay';
import { config } from '../contracts/wagmi';

const queryClient = new QueryClient();

export function WagmiProviderWrapper({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <WalletTxOverlayProvider>{children}</WalletTxOverlayProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
