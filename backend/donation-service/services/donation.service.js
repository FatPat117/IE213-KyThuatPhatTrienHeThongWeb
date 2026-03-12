const Donation = require("../models/Donation.model");
const DONATED_TOPIC0 = "0x1b606d34afacd55873aba0fd274841a10c63e18455f2dffebad2fc60a36b2c83";

function normalizeCampaignTopic(campaignOnChainId) {
    const hex = BigInt(campaignOnChainId).toString(16);
    return `0x${hex.padStart(64, "0")}`;
}

function parseNumberish(value, fallback = 0) {
    if (value === null || value === undefined) return fallback;
    const asText = String(value).trim();
    if (!asText) return fallback;
    try {
        return asText.startsWith("0x") ? Number(BigInt(asText)) : Number(asText);
    } catch {
        return fallback;
    }
}

function decodeAddressFromTopic(topic) {
    if (!topic || typeof topic !== "string" || topic.length < 42) return "";
    return `0x${topic.slice(-40)}`.toLowerCase();
}

async function fetchOnChainDonationsByCampaign(campaignOnChainId) {
    const apiKey = process.env.ETHERSCAN_API_KEY;
    const contractAddress = process.env.CROWDFUNDING_CONTRACT_ADDRESS;
    if (!apiKey || !contractAddress) return [];

    const baseUrl = process.env.ETHERSCAN_LOGS_API_URL || "https://api.etherscan.io/v2/api";
    const chainId = process.env.ETHERSCAN_CHAIN_ID || "11155111";
    const topic1 = normalizeCampaignTopic(campaignOnChainId);
    const maxPages = Number(process.env.ETHERSCAN_LOGS_MAX_PAGES || 5);
    const offset = Number(process.env.ETHERSCAN_LOGS_OFFSET || 1000);
    const rows = [];

    for (let page = 1; page <= maxPages; page += 1) {
        const url = new URL(baseUrl);
        url.searchParams.set("module", "logs");
        url.searchParams.set("action", "getLogs");
        url.searchParams.set("chainid", chainId);
        url.searchParams.set("fromBlock", "0");
        url.searchParams.set("toBlock", "latest");
        url.searchParams.set("address", contractAddress);
        url.searchParams.set("topic0", DONATED_TOPIC0);
        url.searchParams.set("topic1", topic1);
        url.searchParams.set("page", String(page));
        url.searchParams.set("offset", String(offset));
        url.searchParams.set("apikey", apiKey);

        const response = await fetch(url.toString());
        if (!response.ok) break;
        const payload = await response.json();
        if (payload?.status !== "1" && payload?.message !== "No records found") {
            console.warn(
                `[donation-service] Etherscan logs API warning for campaign=${campaignOnChainId}:`,
                payload?.result || payload?.message || "unknown"
            );
            break;
        }
        const resultRows = Array.isArray(payload?.result) ? payload.result : [];
        if (!resultRows.length) break;

        rows.push(...resultRows);
        if (resultRows.length < offset) break;
    }

    return rows
        .map((item) => {
            const amountWei = item?.data ? BigInt(item.data) : 0n;
            return {
                txHash: String(item.transactionHash || "").toLowerCase(),
                campaignOnChainId: Number(campaignOnChainId),
                donorWallet: decodeAddressFromTopic(item?.topics?.[2]),
                amount: amountWei.toString(),
                amountEth: Number(amountWei) / 1e18,
                message: "",
                donatedAt: new Date(parseNumberish(item.timeStamp, 0) * 1000),
            };
        })
        .filter((item) => item.txHash);
}

async function createDonation(data) {
    // Dùng findOneAndUpdate để idempotent (blockchain có thể gửi lại event)
    const { txHash, ...rest } = data;
    return Donation.findOneAndUpdate(
        { txHash },
        { $setOnInsert: { txHash, ...rest } },
        { upsert: true, new: true }
    );
}

async function getDonationsByCampaign(campaignOnChainId) {
    return Donation.find({ campaignOnChainId: Number(campaignOnChainId) })
        .sort({ donatedAt: -1 });
}

async function getMergedDonationsByCampaign(campaignOnChainId) {
    const campaignId = Number(campaignOnChainId);
    const [dbRows, onChainRows] = await Promise.all([
        getDonationsByCampaign(campaignId),
        fetchOnChainDonationsByCampaign(campaignId).catch(() => []),
    ]);

    const byTxHash = new Map();
    dbRows.forEach((row) => byTxHash.set(String(row.txHash).toLowerCase(), row));
    onChainRows.forEach((row) => {
        if (!byTxHash.has(row.txHash)) byTxHash.set(row.txHash, row);
    });

    return Array.from(byTxHash.values()).sort(
        (a, b) => new Date(b.donatedAt).getTime() - new Date(a.donatedAt).getTime()
    );
}

async function getDonationsByDonor(donorWallet) {
    return Donation.find({ donorWallet: donorWallet.toLowerCase() })
        .sort({ donatedAt: -1 });
}

async function getTotalDonatedByCampaign(campaignOnChainId) {
    const result = await Donation.aggregate([
        { $match: { campaignOnChainId: Number(campaignOnChainId) } },
        { $group: { _id: null, total: { $sum: "$amountEth" } } },
    ]);
    return result[0]?.total || 0;
}

module.exports = {
    createDonation,
    getDonationsByCampaign,
    getMergedDonationsByCampaign,
    getDonationsByDonor,
    getTotalDonatedByCampaign,
};
