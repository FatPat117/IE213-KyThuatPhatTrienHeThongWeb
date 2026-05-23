"use client";

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from "react";
import { createPortal } from "react-dom";

type WalletTxOverlayContextValue = {
    registerActive: (active: boolean, stage?: "preparing" | "signing" | "confirming" | "processing", hash?: string) => void;
};

const WalletTxOverlayContext = createContext<WalletTxOverlayContextValue | null>(
    null,
);

/**
 * Full-screen overlay while the user is signing or a transaction is confirming.
 */
export function WalletTxOverlayProvider({ children }: { children: ReactNode }) {
    const [activeCount, setActiveCount] = useState(0);
    const [txHash, setTxHash] = useState<string | null>(null);
    const [currentStage, setCurrentStage] = useState<"preparing" | "signing" | "confirming" | "processing">("signing");
    const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

    const registerActive = useCallback((active: boolean, stage?: "preparing" | "signing" | "confirming" | "processing", hash?: string) => {
        setActiveCount((n) => {
            const next = active ? n + 1 : n - 1;
            return next < 0 ? 0 : next;
        });
        if (active) {
            if (stage) setCurrentStage(stage);
            if (hash) setTxHash(hash);
        } else {
            // Reset when hiding
            setTimeout(() => {
                setTxHash(null);
                setCurrentStage("signing");
            }, 500); // Wait for transition
        }
    }, []);

    const value = useMemo(
        () => ({ registerActive }),
        [registerActive],
    );

    const visible = activeCount > 0;

    useEffect(() => {
        setPortalTarget(document.body);
    }, []);

    useEffect(() => {
        if (!visible) return;
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = prevOverflow;
        };
    }, [visible]);

    const overlay = visible ? (
        <div
            className="fixed inset-0 z-[9999] bg-slate-900/55 backdrop-blur-sm"
            role="alertdialog"
            aria-live="assertive"
            aria-busy="true"
        >
            <div className="flex min-h-dvh w-full items-center justify-center px-6">
                <div className="max-w-sm rounded-2xl border border-white/20 bg-white px-8 py-7 text-center shadow-2xl">
                    <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                    <p className="text-lg font-semibold text-slate-900">
                        {currentStage === "preparing" && "Đang chuẩn bị giao dịch..."}
                        {currentStage === "signing" && "Đang chờ xác nhận từ ví..."}
                        {currentStage === "confirming" && "Đang xử lý trên Blockchain..."}
                        {currentStage === "processing" && "Đang xử lý yêu cầu..."}
                    </p>
                    <p className="mt-2 text-sm text-slate-600">
                        {currentStage === "preparing" && "Hệ thống đang chuẩn bị dữ liệu, vui lòng đợi."}
                        {currentStage === "signing" && "Vui lòng hoàn tất ký trong ví MetaMask của bạn."}
                        {currentStage === "confirming" && "Giao dịch đã được gửi. Vui lòng đợi block được xác nhận."}
                        {currentStage === "processing" && "Hệ thống đang ghi nhận thao tác của bạn, vui lòng đợi."}
                    </p>
                    {txHash && (
                        <div className="mt-4 rounded-lg bg-slate-50 p-3">
                            <p className="mb-1 text-xs text-slate-500">Transaction Hash:</p>
                            <a
                                href={`https://sepolia.etherscan.io/tx/${txHash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="break-all text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline"
                            >
                                {txHash}
                            </a>
                        </div>
                    )}
                </div>
            </div>
        </div>
    ) : null;

    return (
        <WalletTxOverlayContext.Provider value={value}>
            {children}
            {portalTarget && overlay ? createPortal(overlay, portalTarget) : null}
        </WalletTxOverlayContext.Provider>
    );
}

/**
 * Marks global wallet overlay as active while `active` is true (signing or confirming).
 */
export function useRegisterWalletTxOverlay(active: boolean, stage?: "preparing" | "signing" | "confirming" | "processing", hash?: string) {
    const ctx = useContext(WalletTxOverlayContext);
    useEffect(() => {
        if (!ctx || !active) return;
        ctx.registerActive(true, stage, hash);
        return () => {
            ctx.registerActive(false);
        };
    }, [ctx, active, stage, hash]);
}
