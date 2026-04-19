import { fallback, http } from 'viem';
import { createConfig } from 'wagmi';
import { sepolia } from 'wagmi/chains';

const sepoliaRpcUrl = process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL;
const defaultSepoliaRpcUrl = sepolia.rpcUrls.default.http[0];
const rpcCandidates = [defaultSepoliaRpcUrl, sepoliaRpcUrl].filter(
    (url): url is string => Boolean(url)
);

export const config = createConfig({
    chains: [sepolia],
    transports: {
        [sepolia.id]: fallback(rpcCandidates.map((url) => http(url))),
    },
});
