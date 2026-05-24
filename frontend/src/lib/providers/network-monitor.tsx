'use client';

import { useEffect, useRef } from 'react';
import { useAccount, useChainId } from 'wagmi';
import { useSystemStatus } from '../hooks/use-system-status';
import { SEPOLIA_CHAIN_ID } from '../contracts/config';

interface NetworkConfig {
  chainId: number;
  name: string;
}

const REQUIRED_NETWORK: NetworkConfig = {
  chainId: SEPOLIA_CHAIN_ID,
  name: 'Sepolia',
};

export function NetworkStatusMonitor() {
  const { isConnected, chain, chainId: accountChainId } = useAccount();
  const currentChainId = useChainId();
  const { showWalletDisconnected, showWrongNetwork, clearStatus, status } =
    useSystemStatus();
  const wrongToastShownForChainRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isConnected) {
      wrongToastShownForChainRef.current = null;
      if (status?.type === 'wallet-disconnected' || status?.type === 'wrong-network') {
        clearStatus();
      }
      return;
    }

    const resolvedChainId =
      typeof accountChainId === 'number'
        ? accountChainId
        : typeof chain?.id === 'number'
          ? chain.id
          : currentChainId;
    if (resolvedChainId !== REQUIRED_NETWORK.chainId) {
      showWrongNetwork(
        chain?.name || `Chain #${resolvedChainId || 'unknown'}`,
        REQUIRED_NETWORK.name,
      );
      if (wrongToastShownForChainRef.current !== resolvedChainId) {
        wrongToastShownForChainRef.current = resolvedChainId;
      }
      return;
    }

    wrongToastShownForChainRef.current = null;
    if (
      status?.type === 'wallet-disconnected' ||
      status?.type === 'wrong-network'
    ) {
      clearStatus();
    }
  }, [
    isConnected,
    accountChainId,
    chain,
    currentChainId,
    showWalletDisconnected,
    showWrongNetwork,
    clearStatus,
    status?.type,
  ]);

  return null;
}
