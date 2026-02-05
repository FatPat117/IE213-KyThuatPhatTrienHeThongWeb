'use client';

import { useAccount, useConnect, useDisconnect, useChainId } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { useEffect, useState } from 'react';

const SEPOLIA_CHAIN_ID = 11155111;

export default function WalletConnectButton() {
  const { address, isConnected } = useAccount();
  const { connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const [hasProvider, setHasProvider] = useState<boolean | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isSepoliaNetwork = chainId === SEPOLIA_CHAIN_ID;

  useEffect(() => {
    // Kiểm tra sự tồn tại của window.ethereum
    if (typeof window !== 'undefined') {
      setHasProvider(Boolean((window as any).ethereum));
    }
  }, []);

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
    setErrorMessage(null);
  };

  const shortenAddress = (addr: string | undefined) => {
    if (!addr) return '';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  // Hiển thị khi chưa kết nối ví
  if (!isConnected) {
    return (
      <div className="flex flex-col gap-3 max-w-xs">
        <button
          onClick={handleConnect}
          disabled={isPending}
          className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors"
        >
          {isPending ? 'Đang kết nối...' : 'Kết nối ví'}
        </button>
        {errorMessage && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
            ⚠️ {errorMessage}
          </div>
        )}
      </div>
    );
  }

  // Hiển thị khi đã kết nối ví
  return (
    <div className="flex flex-col gap-2 max-w-xs">
      {/* Thông tin ví */}
      <div className={`px-4 py-3 rounded-lg border ${
        isSepoliaNetwork
          ? 'bg-green-50 border-green-300'
          : 'bg-yellow-50 border-yellow-300'
      }`}>
        <p className="text-xs text-gray-700 mb-1">Ví đã kết nối:</p>
        <p className="text-sm font-mono font-bold text-gray-900 break-all">
          {shortenAddress(address)}
        </p>
      </div>

      {/* Thông báo mạng sai */}
      {!isSepoliaNetwork && (
        <div className="px-4 py-3 bg-red-50 border border-red-300 rounded-lg">
          <p className="text-sm font-semibold text-red-900 mb-2">
            ⚠️ Mạng lưới sai
          </p>
          <p className="text-xs text-red-800 mb-3">
            Vui lòng chuyển sang mạng Sepolia trong MetaMask để sử dụng tất cả tính năng.
          </p>
          <button
            onClick={() => window.open('https://chainlist.org/?search=sepolia', '_blank')}
            className="inline-flex items-center justify-center px-3 py-2 rounded-md bg-red-600 text-white text-xs font-semibold hover:bg-red-700 transition"
          >
            Hướng dẫn chuyển mạng
          </button>
        </div>
      )}

      {/* Thông báo kết nối Sepolia thành công */}
      {isSepoliaNetwork && (
        <div className="px-4 py-2 bg-green-50 border border-green-300 rounded-lg text-center">
          <p className="text-xs text-green-700 font-semibold">
            ✓ Kết nối Sepolia thành công
          </p>
        </div>
      )}

      {/* Nút ngắt kết nối */}
      <button
        onClick={handleDisconnect}
        className="px-6 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors text-sm"
      >
        Ngắt kết nối
      </button>
    </div>
  );
}
