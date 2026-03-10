'use client';

import { useEffect, useState } from 'react';
import { useAccount, useChainId, useConnect, useDisconnect, useSignMessage } from 'wagmi';
import { injected } from 'wagmi/connectors';
import WalletConnectedCard from './WalletConnectedCard';
import WalletDisconnectedCard from './WalletDisconnectedCard';
import { requestNonce, useAuth, verifyWalletSignature } from '@/lib';

const SEPOLIA_CHAIN_ID = 11155111;

export default function WalletConnectButton() {
  const { address, isConnected } = useAccount();
  const { connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { signMessageAsync } = useSignMessage();
  const { user, setAuth, clearAuth } = useAuth();
  const chainId = useChainId();
  const [hasProvider, setHasProvider] = useState<boolean | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const isSepoliaNetwork = chainId === SEPOLIA_CHAIN_ID;

  useEffect(() => {
    // Check browser wallet provider once on mount.
    if (typeof window !== 'undefined') {
      setHasProvider(Boolean((window as { ethereum?: unknown }).ethereum));
    }
  }, []);

  useEffect(() => {
    const authenticateWallet = async () => {
      if (!isConnected || !address || isAuthenticating) return;
      if (user?.wallet?.toLowerCase() === address.toLowerCase()) return;

      try {
        setIsAuthenticating(true);
        setErrorMessage(null);

        const { nonce } = await requestNonce(address);
        const signature = await signMessageAsync({ message: nonce });
        const auth = await verifyWalletSignature(address, signature);
        setAuth(auth.token, auth.user);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'SIWE đăng nhập thất bại.';
        setErrorMessage(message);
      } finally {
        setIsAuthenticating(false);
      }
    };
    authenticateWallet();
  }, [address, isAuthenticating, isConnected, setAuth, signMessageAsync, user?.wallet]);

  const handleConnect = async () => {
    try {
      setErrorMessage(null);
      if (!hasProvider) {
        window.open('https://metamask.io/download/', '_blank');
        return;
      }
      connect({ connector: injected() });
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      setErrorMessage('Kết nối ví thất bại. Vui lòng thử lại hoặc kiểm tra MetaMask.');
    }
  };

  const handleDisconnect = () => {
    disconnect();
    clearAuth();
    setErrorMessage(null);
  };

  if (!isConnected) {
    return (
      <WalletDisconnectedCard
        isPending={isPending || isAuthenticating}
        errorMessage={errorMessage}
        onConnect={handleConnect}
      />
    );
  }

  if (!address) {
    return null;
  }

  return (
    <WalletConnectedCard
      address={address}
      isSepoliaNetwork={isSepoliaNetwork}
      authRole={user?.role ?? null}
      onDisconnect={handleDisconnect}
    />
  );
}
