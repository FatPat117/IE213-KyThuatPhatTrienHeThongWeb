'use client';

import { useEffect } from 'react';
import { useAccount } from 'wagmi';
import { useSystemStatus } from '../hooks/use-system-status';

interface NetworkConfig {
  chainId: number;
  name: string;
}

const REQUIRED_NETWORK: NetworkConfig = {
  chainId: 11155111,
  name: 'Sepolia',
};

export function NetworkStatusMonitor() {
  const { address, isConnected, chain } = useAccount();
  const { showWalletDisconnected, showWrongNetwork, clearStatus } = useSystemStatus();

  useEffect(() => {
    if (!isConnected) {
      showWalletDisconnected();
    } else {
      clearStatus();
    }
  }, [isConnected, showWalletDisconnected, clearStatus]);

  useEffect(() => {
    if (isConnected && chain && chain.id !== REQUIRED_NETWORK.chainId) {
      showWrongNetwork(chain.name || 'Mạng lưới không xác định', REQUIRED_NETWORK.name);
    }
  }, [isConnected, chain, showWrongNetwork]);

  return null;
}
