// frontend/e2e/helpers/wallet.ts
// Helpers để giả lập ví injected trong E2E. Không dùng MetaMask thật.

import { Page } from "@playwright/test";

export const TEST_ACCOUNTS = {
    creator: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    donorA: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    donorB: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
    reviewer: "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
} as const;

export const SEPOLIA_CHAIN_ID = 11155111;
export const SEPOLIA_CHAIN_ID_HEX = "0xaa36a7";
export const MOCK_TX_HASH =
    "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

type ConnectMockWalletOptions = {
    chainId?: number;
    chainIdHex?: string;
    txHash?: string;
    authenticated?: boolean;
};

/**
 * Inject mock wallet state trước khi page load để wagmi xem như ví đã kết nối.
 */
export async function connectMockWallet(
    page: Page,
    address: string,
    options: ConnectMockWalletOptions = {},
) {
    const chainId = options.chainId ?? SEPOLIA_CHAIN_ID;
    const chainIdHex = options.chainIdHex ?? SEPOLIA_CHAIN_ID_HEX;
    const txHash = options.txHash ?? MOCK_TX_HASH;
    const authenticated = options.authenticated ?? true;

    await page.addInitScript(
        ({
            walletAddress,
            selectedChainId,
            selectedChainIdHex,
            mockTxHash,
            shouldSeedAuth,
        }) => {
            const listeners = new Map<
                string,
                Array<(...args: unknown[]) => void>
            >();

            const emit = (eventName: string, payload: unknown) => {
                for (const listener of listeners.get(eventName) || []) {
                    listener(payload);
                }
            };

            const ethereum = {
                isMetaMask: true,
                selectedAddress: walletAddress,
                chainId: selectedChainIdHex,
                request: async (request: {
                    method: string;
                    params?: unknown[];
                }) => {
                    switch (request.method) {
                        case "eth_requestAccounts":
                            emit("accountsChanged", [walletAddress]);
                            return [walletAddress];
                        case "eth_accounts":
                            return [walletAddress];
                        case "wallet_requestPermissions":
                            emit("accountsChanged", [walletAddress]);
                            return [
                                {
                                    parentCapability: "eth_accounts",
                                    caveats: [
                                        {
                                            type: "restrictReturnedAccounts",
                                            value: [walletAddress],
                                        },
                                    ],
                                },
                            ];
                        case "wallet_getPermissions":
                            return [
                                {
                                    parentCapability: "eth_accounts",
                                    caveats: [
                                        {
                                            type: "restrictReturnedAccounts",
                                            value: [walletAddress],
                                        },
                                    ],
                                },
                            ];
                        case "eth_chainId":
                            return selectedChainIdHex;
                        case "net_version":
                            return String(selectedChainId);
                        case "wallet_switchEthereumChain":
                        case "wallet_addEthereumChain":
                            emit("chainChanged", selectedChainIdHex);
                            return null;
                        case "personal_sign":
                        case "eth_signTypedData_v4":
                            return `0x${"1".repeat(130)}`;
                        case "eth_sendTransaction":
                            return mockTxHash;
                        case "eth_estimateGas":
                            return "0x7a120";
                        case "eth_getCode":
                            return "0x6080604052";
                        case "eth_getTransactionCount":
                            return "0x1";
                        case "eth_gasPrice":
                        case "eth_maxPriorityFeePerGas":
                            return "0x3b9aca00";
                        case "eth_feeHistory":
                            return {
                                oldestBlock: "0x4ffffb",
                                baseFeePerGas: [
                                    "0x3b9aca00",
                                    "0x3b9aca00",
                                    "0x3b9aca00",
                                ],
                                gasUsedRatio: [0.2, 0.3],
                                reward: [["0x3b9aca00"], ["0x3b9aca00"]],
                            };
                        case "eth_getBalance":
                            return "0xde0b6b3a7640000";
                        case "eth_blockNumber":
                            return "0x500000";
                        case "eth_getTransactionReceipt":
                            return {
                                transactionHash: mockTxHash,
                                status: "0x1",
                                blockNumber: "0x500001",
                                confirmations: "0x1",
                                logs: [],
                            };
                        default:
                            return null;
                    }
                },
                on: (
                    eventName: string,
                    listener: (...args: unknown[]) => void,
                ) => {
                    const current = listeners.get(eventName) || [];
                    listeners.set(eventName, [...current, listener]);
                },
                removeListener: (
                    eventName: string,
                    listener: (...args: unknown[]) => void,
                ) => {
                    const current = listeners.get(eventName) || [];
                    listeners.set(
                        eventName,
                        current.filter((item) => item !== listener),
                    );
                },
                autoRefreshOnNetworkChange: false,
            };

            Object.defineProperty(window, "ethereum", {
                value: ethereum,
                configurable: true,
            });

            localStorage.setItem(
                "wagmi.store",
                JSON.stringify({
                    state: {
                        chainId: selectedChainId,
                        connections: {
                            __type: "Map",
                            value: [
                                [
                                    "injected",
                                    {
                                        accounts: [walletAddress],
                                        chainId: selectedChainId,
                                        connector: {
                                            id: "injected",
                                            name: "Mock Wallet",
                                            type: "injected",
                                            uid: "injected",
                                        },
                                    },
                                ],
                            ],
                        },
                        current: "injected",
                        status: "connected",
                    },
                    version: 3,
                }),
            );
            localStorage.setItem("wagmi.injected.connected", "true");
            localStorage.setItem("wagmi.recentConnectorId", "injected");
            if (shouldSeedAuth) {
                localStorage.setItem(
                    "fundraising_auth",
                    JSON.stringify({
                        token: "e2e-token",
                        user: {
                            wallet: walletAddress,
                            role: "user",
                            displayName: "E2E Wallet",
                        },
                    }),
                );
            }
        },
        {
            walletAddress: address,
            selectedChainId: chainId,
            selectedChainIdHex: chainIdHex,
            mockTxHash: txHash,
            shouldSeedAuth: authenticated,
        },
    );
}

export async function disconnectMockWallet(page: Page) {
    await page.addInitScript(() => {
        localStorage.removeItem("wagmi.store");
        localStorage.removeItem("wagmi.injected.connected");
        localStorage.removeItem("wagmi.recentConnectorId");
        Object.defineProperty(window, "ethereum", {
            value: undefined,
            configurable: true,
        });
    });
}
