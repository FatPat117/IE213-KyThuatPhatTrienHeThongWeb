'use client';

import { useCallback } from 'react';
import { useSystemStatus } from './use-system-status';

/**
 * Hook để xử lý lỗi RPC
 * Phát hiện các loại lỗi cụ thể và hiển thị thông báo thích hợp
 */
export function useRpcErrorHandler() {
  const { showRpcError, showInsufficientGas } = useSystemStatus();

  const handleError = useCallback(
    (error: unknown) => {
      if (!error) return;

      const errorMsg = error instanceof Error ? error.message : String(error);

      if (
        errorMsg.includes('insufficient funds') ||
        errorMsg.includes('out of gas') ||
        errorMsg.includes('gas')
      ) {
        showInsufficientGas();
        return;
      }

      if (
        errorMsg.includes('RPC') ||
        errorMsg.includes('network') ||
        errorMsg.includes('timeout')
      ) {
        showRpcError(errorMsg);
        return;
      }

      showRpcError(errorMsg);
    },
    [showRpcError, showInsufficientGas]
  );

  return { handleError };
}
