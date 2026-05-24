import { fallback, http } from 'viem';
import { createConfig } from 'wagmi';
import { sepolia } from 'wagmi/chains';
import { injected } from 'wagmi/connectors';

const sepoliaRpcUrl = process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL;
const defaultSepoliaRpcUrl = sepolia.rpcUrls.default.http[0];
const publicSepoliaRpcCandidates = [
    'https://ethereum-sepolia-rpc.publicnode.com',
    'https://rpc.sepolia.org',
];

// Prefer user-provided RPC first to avoid shared endpoint throttling.
const rpcCandidates = Array.from(
    new Set(
        [sepoliaRpcUrl, ...publicSepoliaRpcCandidates, defaultSepoliaRpcUrl].filter(
            (url): url is string => Boolean(url && url.trim()),
        ),
    ),
);

export const config = createConfig({
    chains: [sepolia],
    connectors: [injected()],
    batch: { multicall: true },
    transports: {
        [sepolia.id]: fallback(
            rpcCandidates.map((url) =>
                http(url, {
                    timeout: 12_000,
                    retryCount: 1,
                    retryDelay: 400,
                    batch: true,
                }),
            ),
        ),
    },
});
