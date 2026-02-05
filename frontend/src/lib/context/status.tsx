'use client';

import { createContext, useCallback, useState, ReactNode } from 'react';

export type StatusType = 'wallet-disconnected' | 'wrong-network' | 'rpc-error' | 'insufficient-gas' | 'success' | null;

export interface StatusMessage {
  type: StatusType;
  title?: string;
  message: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  dismissible?: boolean;
}

export interface StatusContextType {
  status: StatusMessage | null;
  setStatus: (status: StatusMessage | null) => void;
  clearStatus: () => void;
  showWalletDisconnected: () => void;
  showWrongNetwork: (currentNetwork?: string, requiredNetwork?: string) => void;
  showRpcError: (error?: string) => void;
  showInsufficientGas: (requiredGas?: string) => void;
  showSuccess: (message: string) => void;
}

export const StatusContext = createContext<StatusContextType | undefined>(undefined);

interface StatusProviderProps {
  children: ReactNode;
}

export function StatusProvider({ children }: StatusProviderProps) {
  const [status, setStatus] = useState<StatusMessage | null>(null);

  const clearStatus = useCallback(() => {
    setStatus(null);
  }, []);

  const showWalletDisconnected = useCallback(() => {
    setStatus({
      type: 'wallet-disconnected',
      title: 'Ví chưa kết nối',
      message: 'Vui lòng kết nối ví của bạn để tương tác với ứng dụng.',
      dismissible: true,
    });
  }, []);

  const showWrongNetwork = useCallback(
    (currentNetwork = 'Unknown', requiredNetwork = 'Sepolia') => {
      setStatus({
        type: 'wrong-network',
        title: 'Mạng lưới sai',
        message: `Bạn đang ở trên ${currentNetwork}. Vui lòng chuyển sang mạng thử nghiệm ${requiredNetwork}.`,
        dismissible: true,
      });
    },
    []
  );

  const showRpcError = useCallback((error?: string) => {
    setStatus({
      type: 'rpc-error',
      title: 'Lỗi mạng lưới',
      message: error || 'Đã xảy ra lỗi RPC. Vui lòng kiểm tra kết nối của bạn và thử lại.',
      dismissible: true,
    });
  }, []);

  const showInsufficientGas = useCallback((requiredGas?: string) => {
    setStatus({
      type: 'insufficient-gas',
      title: 'Gas không đủ',
      message: requiredGas
        ? `Bạn cần ít nhất ${requiredGas} để thực hiện giao dịch này. Vui lòng thêm tiền vào ví của bạn.`
        : 'Gas không đủ. Vui lòng thêm tiền vào ví của bạn.',
      dismissible: true,
    });
  }, []);

  const showSuccess = useCallback((message: string) => {
    setStatus({
      type: 'success',
      title: 'Thành công',
      message,
      dismissible: true,
    });
    const timer = setTimeout(() => setStatus(null), 3000);
    return () => clearTimeout(timer);
  }, []);

  const value: StatusContextType = {
    status,
    setStatus,
    clearStatus,
    showWalletDisconnected,
    showWrongNetwork,
    showRpcError,
    showInsufficientGas,
    showSuccess,
  };

  return <StatusContext.Provider value={value}>{children}</StatusContext.Provider>;
}
