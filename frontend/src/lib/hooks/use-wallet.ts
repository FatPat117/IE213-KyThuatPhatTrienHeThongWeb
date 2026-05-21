'use client';

import { useAccount, useChainId } from 'wagmi';
import { useSyncExternalStore } from 'react';

const SEPOLIA_CHAIN_ID = 11155111;

const emptySubscribe = () => () => {};
export function useIsHydrated() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}

/**
 * Hook để định dạng địa chỉ ví dưới dạng rút gọn
 * @param address - Địa chỉ ví đầy đủ
 * @returns Địa chỉ rút gọn (6 ký tự đầu + 4 ký tự cuối)
 */
export function useShortenAddress(address: string | undefined): string {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Hook để kiểm tra xem ví có được kết nối với mạng Sepolia không
 * @returns Boolean cho biết có phải mạng Sepolia không
 */
export function useIsSepoliaNetwork(): boolean {
  const chainId = useChainId();
  return chainId === SEPOLIA_CHAIN_ID;
}

/**
 * Hook để lấy trạng thái kết nối ví và xác thực mạng lưới
 * @returns Object với trạng thái kết nối, địa chỉ và thông tin mạng
 */
export function useWalletStatus() {
  const { address, isConnected } = useAccount();
  const isSepoliaNetwork = useIsSepoliaNetwork();
  const shortenedAddress = useShortenAddress(address);
  const isHydrated = useIsHydrated();

  return {
    address: isHydrated ? address : undefined,
    shortenedAddress: isHydrated ? shortenedAddress : '',
    isConnected: isHydrated ? isConnected : false,
    isSepoliaNetwork: isHydrated ? isSepoliaNetwork : false,
    isValidNetwork: isHydrated ? isConnected && isSepoliaNetwork : false,
  };
}

/**
 * Hook để xác thực kết nối ví và mạng lưới
 * @returns Object với kết quả xác thực và thông báo lỗi
 */
export function useWalletValidation() {
  const { isConnected } = useAccount();
  const isSepoliaNetwork = useIsSepoliaNetwork();
  const isHydrated = useIsHydrated();

  const safeIsConnected = isHydrated ? isConnected : false;
  const safeIsSepoliaNetwork = isHydrated ? isSepoliaNetwork : false;

  const isValid = safeIsConnected && safeIsSepoliaNetwork;
  const errors: string[] = [];

  if (!safeIsConnected) {
    errors.push('Ví chưa được kết nối. Vui lòng kết nối MetaMask.');
  }

  if (safeIsConnected && !safeIsSepoliaNetwork) {
    errors.push('Mạng lưới sai. Vui lòng chuyển sang mạng Sepolia.');
  }

  return {
    isValid,
    errors,
    isConnected: safeIsConnected,
    isSepoliaNetwork: safeIsSepoliaNetwork,
  };
}
