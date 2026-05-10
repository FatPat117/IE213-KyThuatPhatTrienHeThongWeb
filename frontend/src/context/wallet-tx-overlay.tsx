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

type WalletTxOverlayContextValue = {
    registerActive: (active: boolean, stage?: "preparing" | "signing" | "confirming", hash?: string) => void;
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
    const [currentStage, setCurrentStage] = useState<"preparing" | "signing" | "confirming">("signing");

    const registerActive = useCallback((active: boolean, stage?: "preparing" | "signing" | "confirming", hash?: string) => {
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

    return (
        <WalletTxOverlayContext.Provider value={value}>
            {children}
            {visible ? (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/55 px-6 backdrop-blur-sm"
                    role="alertdialog"
                    aria-live="assertive"
                    aria-busy="true"
                >
                    <div className="max-w-sm rounded-2xl border border-white/20 bg-white px-8 py-7 text-center shadow-2xl">
                        <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                        <p className="text-lg font-semibold text-slate-900">
                            {currentStage === "preparing" && "Đang chuẩn bị giao dịch..."}
                            {currentStage === "signing" && "Đang chờ xác nhận từ ví..."}
                            {currentStage === "confirming" && "Đang xử lý trên Blockchain..."}
                        </p>
                        <p className="mt-2 text-sm text-slate-600">
                            {currentStage === "preparing" && "Hệ thống đang chuẩn bị dữ liệu, vui lòng đợi."}
                            {currentStage === "signing" && "Vui lòng hoàn tất ký trong ví MetaMask của bạn."}
                            {currentStage === "confirming" && "Giao dịch đã được gửi. Vui lòng đợi block được xác nhận."}
                        </p>
                        {txHash && (
                            <div className="mt-4 rounded-lg bg-slate-50 p-3">
                                <p className="text-xs text-slate-500 mb-1">Transaction Hash:</p>
                                <a 
                                    href={`https://sepolia.etherscan.io/tx/${txHash}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline break-all"
                                >
                                    {txHash}
                                </a>
                            </div>
                        )}
                    </div>
                </div>
            ) : null}
        </WalletTxOverlayContext.Provider>
    );
}

/**
 * Marks global wallet overlay as active while `active` is true (signing or confirming).
 */
export function useRegisterWalletTxOverlay(active: boolean, stage?: "preparing" | "signing" | "confirming", hash?: string) {
    const ctx = useContext(WalletTxOverlayContext);
    useEffect(() => {
        if (!ctx || !active) return;
        ctx.registerActive(true, stage, hash);
        return () => {
            ctx.registerActive(false);
        };
    }, [ctx, active, stage, hash]);
}
