"use client";

import { useEffect, useState } from "react";
import { useSyncExternalStore } from "react";
import {
    useAccount,
    useChainId,
    useConnect,
    useDisconnect,
    useSignMessage,
    useSwitchChain,
} from "wagmi";
import WalletConnectedCard from "./WalletConnectedCard";
import WalletDisconnectedCard from "./WalletDisconnectedCard";
import { requestNonce, useAuth, verifyWalletSignature } from "@/lib";
import {
    getBackendErrorMessage,
    getWalletErrorMessage,
} from "@/lib/errors/normalize";

const SEPOLIA_CHAIN_ID = 11155111;
const EMPTY_SUBSCRIBE = () => () => {};
const isIgnorableConnectorError = (message: string) => {
    const normalized = message.toLowerCase();
    return normalized.includes("connector not connected");
};

export default function WalletConnectButton({
    displayRole,
}: {
    displayRole?: string | null;
}) {
    const isHydrated = useSyncExternalStore(
        EMPTY_SUBSCRIBE,
        () => true,
        () => false,
    );
    const { address, isConnected } = useAccount();
    const { connect, connectors, isPending } = useConnect();
    const { disconnect } = useDisconnect();
    const { signMessageAsync } = useSignMessage();
    const { switchChain, isPending: isSwitchingNetwork } = useSwitchChain();
    const { user, token, setAuth, clearAuth } = useAuth();
    const chainId = useChainId();
    const [hasProvider, setHasProvider] = useState<boolean | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [isAuthenticating, setIsAuthenticating] = useState(false);
    const [isDisconnecting, setIsDisconnecting] = useState(false);
    const [authAttemptedWallet, setAuthAttemptedWallet] = useState<
        string | null
    >(null);

    const isSepoliaNetwork = chainId === SEPOLIA_CHAIN_ID;
    const isAuthenticated = Boolean(
        token &&
        user?.wallet &&
        address &&
        user.wallet.toLowerCase() === address.toLowerCase(),
    );

    const resolveAuthError = (error: unknown) => {
        const rawMessage =
            error instanceof Error ? error.message : String(error || "");
        const normalized = rawMessage.toLowerCase();
        const isWalletError =
            normalized.includes("user rejected") ||
            normalized.includes("user denied") ||
            normalized.includes("not authorized") ||
            normalized.includes("signature") ||
            normalized.includes("connector");

        if (isWalletError) {
            return getWalletErrorMessage(error, {
                fallback: "Ký xác thực ví thất bại. Vui lòng thử lại.",
            });
        }

        return getBackendErrorMessage(error, {
            fallback: "Xác thực ví thất bại. Vui lòng thử lại.",
        });
    };

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
            const rawMessage = error instanceof Error ? error.message : "";
            if (isDisconnecting || isIgnorableConnectorError(rawMessage)) {
                // Ignore transient errors caused by user-initiated disconnect.
                return;
            }
            setErrorMessage(resolveAuthError(error));
        } finally {
            setIsAuthenticating(false);
        }
    };

    useEffect(() => {
        // Check browser wallet provider once on mount.
        if (typeof window !== "undefined") {
            setHasProvider(
                Boolean((window as { ethereum?: unknown }).ethereum),
            );
        }
    }, []);

    useEffect(() => {
        if (!isConnected || !address) return;
        if (isDisconnecting) return;
        if (isAuthenticated || isAuthenticating) return;
        if (authAttemptedWallet === address.toLowerCase()) return;

        authenticateWallet(address);
    }, [
        address,
        authAttemptedWallet,
        isAuthenticated,
        isAuthenticating,
        isConnected,
        isDisconnecting,
        signMessageAsync,
    ]);

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
                if (!isAuthenticated && !isAuthenticating) {
                    await authenticateWallet(address);
                }
                return;
            }

            if (hasProvider === false) {
                window.open("https://metamask.io/download/", "_blank");
                return;
            }
            if (hasProvider === null) {
                const providerExists = Boolean(
                    (window as { ethereum?: unknown }).ethereum,
                );
                setHasProvider(providerExists);
                if (!providerExists) {
                    window.open("https://metamask.io/download/", "_blank");
                    return;
                }
            }
            const injectedConnector =
                connectors.find((connector) => connector.id === "injected") ??
                connectors[0];
            if (!injectedConnector) {
                setErrorMessage(
                    "Không tìm thấy connector ví khả dụng. Vui lòng tải lại trang.",
                );
                return;
            }
            await connect({ connector: injectedConnector });
        } catch (error) {
            console.error("Failed to connect wallet:", error);
            const rawMessage = error instanceof Error ? error.message : "";
            if (isIgnorableConnectorError(rawMessage)) {
                setErrorMessage(null);
                return;
            }
            setErrorMessage(
                getWalletErrorMessage(error, {
                    fallback: "Kết nối ví thất bại. Vui lòng thử lại.",
                }),
            );
        }
    };

    const handleDisconnect = async () => {
        setIsDisconnecting(true);
        setErrorMessage(null);
        setAuthAttemptedWallet(null);
        clearAuth();
        try {
            await disconnect();
        } catch {
            // No-op: disconnect can throw if connector is already gone.
        } finally {
            setIsDisconnecting(false);
        }
    };

    const handleSwitchNetwork = () => {
        setErrorMessage(null);
        switchChain({ chainId: SEPOLIA_CHAIN_ID });
    };

    if (!isHydrated) {
        // Keep server/client initial DOM identical to avoid hydration mismatch.
        return <div className="h-10 w-36" aria-hidden />;
    }

    if (!isConnected || !isAuthenticated) {
        return (
            <WalletDisconnectedCard
                isPending={isPending || isAuthenticating}
                errorMessage={errorMessage}
                onConnect={handleConnect}
                buttonLabel={isConnected ? "Ký xác thực ví" : "Kết nối ví"}
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
            authRole={displayRole ?? user?.role ?? null}
            displayName={user?.displayName}
            avatarUrl={user?.avatarUrl}
            onDisconnect={handleDisconnect}
            isDisconnecting={isDisconnecting}
            onSwitchToSepolia={handleSwitchNetwork}
            isSwitchingNetwork={isSwitchingNetwork}
        />
    );
}
