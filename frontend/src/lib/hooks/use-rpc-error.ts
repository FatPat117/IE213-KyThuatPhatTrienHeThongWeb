"use client";

import { useCallback } from "react";
import { useSystemStatus } from "./use-system-status";
import { getRpcErrorMessage } from "../errors/normalize";

/**
 * Hook để xử lý lỗi RPC
 * Phát hiện các loại lỗi cụ thể và hiển thị thông báo thích hợp
 */
export function useRpcErrorHandler() {
    const { showRpcError, showInsufficientGas } = useSystemStatus();

    const handleError = useCallback(
        (error: unknown) => {
            if (!error) return;

            const rawMessage =
                error instanceof Error ? error.message : String(error);

            if (
                rawMessage.includes("insufficient funds") ||
                rawMessage.includes("out of gas") ||
                rawMessage.includes("gas")
            ) {
                showInsufficientGas();
                return;
            }

            showRpcError(getRpcErrorMessage(error));
        },
        [showRpcError, showInsufficientGas],
    );

    return { handleError };
}
