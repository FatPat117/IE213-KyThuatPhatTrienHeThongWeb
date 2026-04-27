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
    registerActive: (active: boolean) => void;
};

const WalletTxOverlayContext = createContext<WalletTxOverlayContextValue | null>(
    null,
);

/**
 * Full-screen overlay while the user is signing or a transaction is confirming.
 */
export function WalletTxOverlayProvider({ children }: { children: ReactNode }) {
    const [activeCount, setActiveCount] = useState(0);

    const registerActive = useCallback((active: boolean) => {
        setActiveCount((n) => {
            const next = active ? n + 1 : n - 1;
            return next < 0 ? 0 : next;
        });
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
                            Đang chờ xác nhận từ ví...
                        </p>
                        <p className="mt-2 text-sm text-slate-600">
                            Vui lòng hoàn tất ký trong ví hoặc chờ giao dịch được xác nhận trên
                            chuỗi.
                        </p>
                    </div>
                </div>
            ) : null}
        </WalletTxOverlayContext.Provider>
    );
}

/**
 * Marks global wallet overlay as active while `active` is true (signing or confirming).
 */
export function useRegisterWalletTxOverlay(active: boolean) {
    const ctx = useContext(WalletTxOverlayContext);
    useEffect(() => {
        if (!ctx || !active) return;
        ctx.registerActive(true);
        return () => {
            ctx.registerActive(false);
        };
    }, [ctx, active]);
}
