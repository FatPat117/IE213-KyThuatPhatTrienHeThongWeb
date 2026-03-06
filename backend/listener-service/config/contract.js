/**
 * TODO: Import ABI từ smart_contracts/artifacts sau khi Blockchain dev
 *       compile xong contract có các events: CampaignCreated, Donated, CertificateMinted.
 *
 * Hiện tại FundRaising.sol chưa có events cần thiết.
 * Sau khi contract được viết lại, thay phần ABI_PLACEHOLDER bên dưới
 * bằng ABI thực từ artifacts/contracts/FundRaising.json
 */

const { ethers } = require("ethers");

// TODO: Thay bằng ABI thực sau khi compile
const CONTRACT_ABI_PLACEHOLDER = [
    // Ví dụ cấu trúc events sẽ có:
    // "event CampaignCreated(uint256 indexed campaignId, address indexed creator, string title, uint256 goal, uint256 deadline)",
    // "event Donated(uint256 indexed campaignId, address indexed donor, uint256 amount)",
    // "event CertificateMinted(uint256 indexed tokenId, uint256 indexed campaignId, address indexed owner, string metadataUri)",
];

function createContractInstance() {
    const rpcUrl = process.env.SEPOLIA_RPC_URL;
    const contractAddress = process.env.CROWDFUNDING_CONTRACT_ADDRESS;

    if (!rpcUrl || !contractAddress || contractAddress === "0x0000000000000000000000000000000000000000") {
        console.warn("[listener-service] SEPOLIA_RPC_URL hoặc CONTRACT_ADDRESS chưa cấu hình – bỏ qua contract listener");
        return null;
    }

    // TODO: Thay CONTRACT_ABI_PLACEHOLDER bằng ABI thực
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const contract = new ethers.Contract(contractAddress, CONTRACT_ABI_PLACEHOLDER, provider);
    return { provider, contract };
}

module.exports = { createContractInstance };
