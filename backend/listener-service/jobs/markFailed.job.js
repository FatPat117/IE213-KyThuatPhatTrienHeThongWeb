const { ethers } = require("ethers");
const { CONTRACT_ABI, resolveContractConfig } = require("../config/contract");

const ACTIVE_STATUS = 0;
const DAY_MS = 24 * 60 * 60 * 1000;

function isCampaignFailedByRule(campaign, nowSec) {
    if (!campaign) return false;
    return (
        Number(campaign.status) === ACTIVE_STATUS &&
        BigInt(campaign.totalRaised) < BigInt(campaign.goal) &&
        Number(campaign.deadline) <= nowSec
    );
}

async function runMarkFailedSweep() {
    const resolved = resolveContractConfig();
    const privateKey = process.env.MARK_FAILED_PRIVATE_KEY || process.env.PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY;

    if (!resolved || !privateKey) {
        console.warn("[listener-service] markAsFailed job bị tắt (thiếu contract config hoặc private key).");
        return;
    }

    const provider = new ethers.JsonRpcProvider(resolved.rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);
    const readContract = new ethers.Contract(resolved.contractAddress, CONTRACT_ABI, provider);
    const writeContract = new ethers.Contract(resolved.contractAddress, CONTRACT_ABI, wallet);

    const nowSec = Math.floor(Date.now() / 1000);
    const campaignCount = Number(await readContract.campaignCount());

    if (!campaignCount) {
        console.log("[listener-service] markAsFailed job: không có campaign nào.");
        return;
    }

    let updatedCount = 0;

    for (let campaignId = 1; campaignId <= campaignCount; campaignId += 1) {
        try {
            const campaign = await readContract.getCampaign(BigInt(campaignId));
            if (!isCampaignFailedByRule(campaign, nowSec)) continue;

            const tx = await writeContract.markAsFailed(BigInt(campaignId));
            console.log(`[listener-service] markAsFailed tx sent: campaignId=${campaignId}, tx=${tx.hash}`);
            await tx.wait();
            updatedCount += 1;
        } catch (err) {
            const message = err?.shortMessage || err?.reason || err?.message || "unknown error";
            console.warn(`[listener-service] markAsFailed bỏ qua campaignId=${campaignId}: ${message}`);
        }
    }

    console.log(`[listener-service] markAsFailed job hoàn tất. campaigns updated=${updatedCount}`);
}

function startMarkFailedDailyJob() {
    const enabled = process.env.MARK_FAILED_JOB_ENABLED !== "false";
    if (!enabled) {
        console.log("[listener-service] markAsFailed job disabled by MARK_FAILED_JOB_ENABLED=false");
        return null;
    }

    const everyMs = Number(process.env.MARK_FAILED_JOB_INTERVAL_MS || DAY_MS);
    if (!Number.isFinite(everyMs) || everyMs <= 0) {
        console.warn("[listener-service] MARK_FAILED_JOB_INTERVAL_MS không hợp lệ, dùng mặc định 24h.");
    }

    const intervalMs = Number.isFinite(everyMs) && everyMs > 0 ? everyMs : DAY_MS;

    runMarkFailedSweep().catch((err) => {
        console.error("[listener-service] markAsFailed job failed:", err?.message || err);
    });

    return setInterval(() => {
        runMarkFailedSweep().catch((err) => {
            console.error("[listener-service] markAsFailed job failed:", err?.message || err);
        });
    }, intervalMs);
}

module.exports = { startMarkFailedDailyJob, runMarkFailedSweep };
