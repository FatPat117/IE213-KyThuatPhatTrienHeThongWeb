import { createConfig, http } from 'wagmi';
import { sepolia } from 'wagmi/chains';

const sepoliaRpcUrl = process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL;

if (!sepoliaRpcUrl) {
    throw new Error('NEXT_PUBLIC_SEPOLIA_RPC_URL is not defined in environment variables');
}

export const config = createConfig({
    chains: [sepolia],
    transports: {
        [sepolia.id]: http(sepoliaRpcUrl),
    },
});
