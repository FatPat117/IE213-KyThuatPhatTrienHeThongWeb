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
import { LoadingSpinner } from "@/components/ui/loading";
import { createPortal } from "react-dom";

type WalletTxOverlayContextValue = {
    setCount: (active: boolean) => void;
    setTxInfo: (stage?: "preparing" | "signing" | "confirming" | "processing", hash?: string) => void;
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

    const setCount = useCallback((active: boolean) => {
        setActiveCount((n) => {
            const next = active ? n + 1 : n - 1;
            return next < 0 ? 0 : next;
        });
        if (!active) {
            // Reset visual state after overlay fades out
            setTimeout(() => {
                setTxHash(null);
                setCurrentStage("signing");
            }, 500);
        }
    }, []);

    const setTxInfo = useCallback((
        stage?: "preparing" | "signing" | "confirming" | "processing",
        hash?: string,
    ) => {
        if (stage) setCurrentStage(stage);
        if (hash) setTxHash(hash);
    }, []);

    const value = useMemo(
        () => ({ setCount, setTxInfo }),
        [setCount, setTxInfo],
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
            data-wallet-tx-overlay
            className="fixed inset-0 bg-[rgba(5,5,16,0.72)] backdrop-blur-md"
            role="alertdialog"
            aria-live="assertive"
            aria-busy="true"
        >
            <div className="flex min-h-dvh w-full items-center justify-center px-6">
                <div className="web3-glass-card max-w-sm rounded-2xl border border-[var(--border-glow)] px-8 py-7 text-center shadow-2xl shadow-black/50">
                    <LoadingSpinner size="md" className="mx-auto mb-4" />
                    <p className="text-lg font-semibold text-[var(--text-primary)]">
                        {currentStage === "preparing" && "Đang chuẩn bị giao dịch..."}
                        {currentStage === "signing" && "Đang chờ xác nhận từ ví..."}
                        {currentStage === "confirming" && "Đang xử lý trên Blockchain..."}
                        {currentStage === "processing" && "Đang xử lý yêu cầu..."}
                    </p>
                    <p className="mt-2 text-sm text-[var(--text-secondary)]">
                        {currentStage === "preparing" && "Hệ thống đang chuẩn bị dữ liệu, vui lòng đợi."}
                        {currentStage === "signing" && "Vui lòng hoàn tất ký trong ví MetaMask của bạn."}
                        {currentStage === "confirming" && "Giao dịch đã được gửi. Vui lòng đợi block được xác nhận."}
                        {currentStage === "processing" && "Hệ thống đang ghi nhận thao tác của bạn, vui lòng đợi."}
                    </p>
                    {txHash && (
                        <div className="mt-4 rounded-lg border border-[rgba(99,102,241,0.25)] bg-[rgba(99,102,241,0.1)] p-3">
                            <p className="mb-1 text-xs text-[var(--text-secondary)]">
                                Transaction Hash:
                            </p>
                            <a
                                href={`https://sepolia.etherscan.io/tx/${txHash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="break-all text-sm font-medium text-[var(--accent-cyan)] hover:text-[var(--accent-primary)] hover:underline"
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
 *
 * Uses two separate effects to avoid counter imbalance:
 * - Effect 1: only tracks `active` → manages the counter (increment/decrement).
 *   Does NOT depend on `stage`/`hash` so that visual-only updates do NOT trigger
 *   a cleanup (decrement) + re-register (increment) cycle that would momentarily
 *   drop activeCount to 0 and hide the overlay mid-transaction.
 * - Effect 2: tracks `stage`/`hash` → updates the display text without touching the counter.
 */
export function useRegisterWalletTxOverlay(
    active: boolean,
    stage?: "preparing" | "signing" | "confirming" | "processing",
    hash?: string,
) {
    const ctx = useContext(WalletTxOverlayContext);

    // Effect 1: manages counter only. MUST NOT include stage/hash in deps.
    useEffect(() => {
        if (!ctx || !active) return;
        ctx.setCount(true);
        return () => {
            ctx.setCount(false);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ctx, active]);

    // Effect 2: pushes stage/hash to the overlay for display only — never touches the counter.
    useEffect(() => {
        if (!ctx || !active) return;
        ctx.setTxInfo(stage, hash);
    }, [ctx, active, stage, hash]);
}
