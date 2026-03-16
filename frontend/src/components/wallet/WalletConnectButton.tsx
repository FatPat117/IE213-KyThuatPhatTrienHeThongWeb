'use client';

import { useEffect, useState } from 'react';
import { useAccount, useChainId, useConnect, useDisconnect, useSignMessage, useSwitchChain } from 'wagmi';
import { injected } from 'wagmi/connectors';
import WalletConnectedCard from './WalletConnectedCard';
import WalletDisconnectedCard from './WalletDisconnectedCard';
import { requestNonce, useAuth, verifyWalletSignature } from '@/lib';

const SEPOLIA_CHAIN_ID = 11155111;
const isIgnorableConnectorError = (message: string) => {
  const normalized = message.toLowerCase();
  return normalized.includes('connector not connected');
};

export default function WalletConnectButton() {
  const { address, isConnected } = useAccount();
  const { connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { signMessageAsync } = useSignMessage();
  const { switchChain, isPending: isSwitchingNetwork } = useSwitchChain();
  const { user, token, setAuth, clearAuth } = useAuth();
  const chainId = useChainId();
  const [hasProvider, setHasProvider] = useState<boolean | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [authAttemptedWallet, setAuthAttemptedWallet] = useState<string | null>(null);

  const isSepoliaNetwork = chainId === SEPOLIA_CHAIN_ID;
  const isAuthenticated = Boolean(
    token &&
      user?.wallet &&
      address &&
      user.wallet.toLowerCase() === address.toLowerCase()
  );

  const authenticateWallet = async (walletAddress: string) => {
    try {
      setIsAuthenticating(true);
      setErrorMessage(null);
      setAuthAttemptedWallet(walletAddress.toLowerCase());

      const { nonce } = await requestNonce(walletAddress);
      const signature = await signMessageAsync({ message: nonce });
      const auth = await verifyWalletSignature(walletAddress, signature);
      setAuth(auth.token, auth.user);
    } catch (error) {
      clearAuth();
      const rawMessage = error instanceof Error ? error.message : 'SIWE đăng nhập thất bại.';
      const normalized = rawMessage.toLowerCase();
      if (isDisconnecting || isIgnorableConnectorError(rawMessage)) {
        // Ignore transient errors caused by user-initiated disconnect.
        return;
      }
      if (normalized.includes('user rejected') || normalized.includes('user denied')) {
        setErrorMessage('Bạn cần ký xác thực để tiếp tục sử dụng tính năng.');
      } else {
        setErrorMessage(rawMessage);
      }
    } finally {
      setIsAuthenticating(false);
    }
  };

  useEffect(() => {
    // Check browser wallet provider once on mount.
    if (typeof window !== 'undefined') {
      setHasProvider(Boolean((window as { ethereum?: unknown }).ethereum));
    }
  }, []);

  useEffect(() => {
    if (!isConnected || !address) return;
    if (isDisconnecting) return;
    if (isAuthenticated || isAuthenticating) return;
    if (authAttemptedWallet === address.toLowerCase()) return;

    authenticateWallet(address);
  }, [address, authAttemptedWallet, isAuthenticated, isAuthenticating, isConnected, isDisconnecting, signMessageAsync]);

  useEffect(() => {
    if (isConnected) return;
    setAuthAttemptedWallet(null);
    setErrorMessage(null);
    setIsDisconnecting(false);
  }, [isConnected]);

  const handleConnect = async () => {
    try {
      setErrorMessage(null);

      if (isConnected && address) {
        await authenticateWallet(address);
        return;
      }

      if (!hasProvider) {
        window.open('https://metamask.io/download/', '_blank');
        return;
      }
      connect({ connector: injected() });
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      const rawMessage = error instanceof Error ? error.message : '';
      if (isIgnorableConnectorError(rawMessage)) {
        setErrorMessage(null);
        return;
      }
      setErrorMessage('Kết nối ví thất bại. Vui lòng thử lại hoặc kiểm tra MetaMask.');
    }
  };

  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    try {
      await disconnect();
    } catch {
      // No-op: disconnect can throw if connector is already gone.
    }
    clearAuth();
    setAuthAttemptedWallet(null);
    setErrorMessage(null);
  };

  const handleSwitchNetwork = () => {
    setErrorMessage(null);
    switchChain({ chainId: SEPOLIA_CHAIN_ID });
  };

  if (!isConnected || !isAuthenticated) {
    return (
      <WalletDisconnectedCard
        isPending={isPending || isAuthenticating}
        errorMessage={errorMessage}
        onConnect={handleConnect}
        buttonLabel={isConnected ? 'Ký xác thực ví' : 'Kết nối ví'}
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
      displayName={user?.displayName}
      avatarUrl={user?.avatarUrl}
      onDisconnect={handleDisconnect}
      onSwitchToSepolia={handleSwitchNetwork}
      isSwitchingNetwork={isSwitchingNetwork}
    />
  );
}
