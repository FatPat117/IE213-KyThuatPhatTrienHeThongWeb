const { ethers } = require("ethers");
const CONTRACT_ABI = require("./FundingPlatform.abi.json");

function createContractInstance() {
    const rpcUrl = process.env.SEPOLIA_RPC_URL;
    let contractAddress = process.env.CROWDFUNDING_CONTRACT_ADDRESS;

    // Ưu tiên đọc từ shared volume nếu đang ở dev/anvil
    const sharedPath = "/app/shared/contract-address.txt";
    const fs = require("fs");
    if (fs.existsSync(sharedPath)) {
        try {
            const dynamicAddress = fs.readFileSync(sharedPath, "utf8").trim();
            if (dynamicAddress) {
                console.log(`[listener-service] Đang dùng dynamic contract address: ${dynamicAddress}`);
                contractAddress = dynamicAddress;
            }
        } catch (err) {
            console.error("[listener-service] Không thể đọc dynamic address:", err.message);
        }
    }

    if (!rpcUrl || !contractAddress || contractAddress === "0x0000000000000000000000000000000000000000") {
        console.warn("[listener-service] SEPOLIA_RPC_URL hoặc CONTRACT_ADDRESS chưa cấu hình – bỏ qua contract listener");
        return null;
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const contract = new ethers.Contract(contractAddress, CONTRACT_ABI, provider);
    return { provider, contract };
}

module.exports = { createContractInstance };
