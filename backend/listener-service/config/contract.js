const { ethers } = require("ethers");
const CONTRACT_ABI = require("./FundingPlatform.abi.json");
const RPC_LOGS_MAX_BLOCK_RANGE = Number(
    process.env.RPC_LOGS_MAX_BLOCK_RANGE || 10,
);

function toBlockNumber(value) {
    if (typeof value === "number" && Number.isFinite(value)) {
        return value;
    }
    if (typeof value === "bigint") {
        return Number(value);
    }
    if (typeof value === "string") {
        if (value.startsWith("0x")) {
            const parsed = Number.parseInt(value, 16);
            return Number.isFinite(parsed) ? parsed : null;
        }
        const parsed = Number.parseInt(value, 10);
        return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
}

function createRangeFilter(baseFilter, fromBlock, toBlock) {
    return {
        ...baseFilter,
        fromBlock: ethers.toQuantity(fromBlock),
        toBlock: ethers.toQuantity(toBlock),
    };
}

function withGetLogsChunking(provider) {
    const originalGetLogs = provider.getLogs.bind(provider);
    provider.getLogs = async (filter) => {
        const fromBlock = toBlockNumber(filter?.fromBlock);
        const toBlock = toBlockNumber(filter?.toBlock);
        // Some RPC free tiers enforce range as an inclusive block count.
        // Example: limit=10 means max span is 9 (from..to includes 10 blocks).
        const maxBlocksPerRequest = Number.isFinite(RPC_LOGS_MAX_BLOCK_RANGE)
            ? Math.max(RPC_LOGS_MAX_BLOCK_RANGE, 1)
            : 10;
        const maxSpan = Math.max(maxBlocksPerRequest - 1, 0);

        if (
            fromBlock === null ||
            toBlock === null ||
            toBlock <= fromBlock ||
            toBlock - fromBlock <= maxSpan
        ) {
            return originalGetLogs(filter);
        }

        const logs = [];
        for (
            let start = fromBlock;
            start <= toBlock;
            start += maxSpan + 1
        ) {
            const end = Math.min(start + maxSpan, toBlock);
            const partialLogs = await originalGetLogs(
                createRangeFilter(filter, start, end),
            );
            logs.push(...partialLogs);
        }

        return logs;
    };

    return provider;
}

function resolveContractConfig() {
    const primaryRpcUrl = process.env.SEPOLIA_RPC_URL;
    const fallbackRpcUrls = (process.env.SEPOLIA_RPC_FALLBACK_URLS || "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);

    const rpcUrls = [primaryRpcUrl, ...fallbackRpcUrls].filter(Boolean);
    let contractAddress = process.env.CROWDFUNDING_CONTRACT_ADDRESS;
    const useDynamicAddress = process.env.USE_DYNAMIC_CONTRACT_ADDRESS === "true";

    // Chỉ đọc dynamic address khi bật cờ rõ ràng.
    // Trên Sepolia production-like, ưu tiên địa chỉ cố định từ env để tránh "nhảy" contract ngoài ý muốn.
    const sharedPath = "/app/shared/contract-address.txt";
    const fs = require("fs");
    if (useDynamicAddress && fs.existsSync(sharedPath)) {
        try {
            const dynamicAddress = fs.readFileSync(sharedPath, "utf8").trim();
            if (dynamicAddress) {
                console.log(`[listener-service] Đang dùng dynamic contract address: ${dynamicAddress}`);
                contractAddress = dynamicAddress;
            }
        } catch (err) {
            console.error("[listener-service] Không thể đọc dynamic address:", err.message);
        }
    } else if (!useDynamicAddress) {
        console.log(`[listener-service] Đang dùng contract address từ env: ${contractAddress}`);
    }

    if (
        rpcUrls.length === 0 ||
        !contractAddress ||
        contractAddress === "0x0000000000000000000000000000000000000000"
    ) {
        console.warn("[listener-service] SEPOLIA_RPC_URL hoặc CONTRACT_ADDRESS chưa cấu hình – bỏ qua contract listener");
        return null;
    }

    return { rpcUrls, contractAddress };
}

function createContractInstance() {
    const resolved = resolveContractConfig();
    if (!resolved) return null;

    const wssUrl = process.env.SEPOLIA_WSS_URL;
    let provider;

    if (wssUrl && wssUrl.startsWith("ws")) {
        console.log("[listener-service] Đang kết nối qua WebSocket (WSS) để nhận sự kiện real-time...");
        provider = new ethers.WebSocketProvider(wssUrl, 11155111);
    } else {
        const providers = resolved.rpcUrls.map((url, index) => {
            const p = withGetLogsChunking(
                new ethers.JsonRpcProvider(url, 11155111, {
                    staticNetwork: true,
                    batchMaxCount: 50,
                }),
            );
            p.pollingInterval = 15000;
            return {
                provider: p,
                priority: index + 1,
                weight: 1,
                stallTimeout: 2000,
            };
        });

        provider =
            providers.length === 1
                ? providers[0].provider
                : new ethers.FallbackProvider(providers, undefined, {
                      quorum: 1,
                  });
    }

    const contract = new ethers.Contract(resolved.contractAddress, CONTRACT_ABI, provider);
    return { provider, contract };
}

module.exports = { createContractInstance, resolveContractConfig, CONTRACT_ABI };
