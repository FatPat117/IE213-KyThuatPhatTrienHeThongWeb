const { ethers } = require("ethers");
const axios = require("axios");
const cron = require("node-cron");
const { CONTRACT_ABI, resolveContractConfig } = require("../config/contract");
const { getChannel, EXCHANGE } = require("../config/rabbitmq");

const ACTIVE_STATUS = 0;
const DEFAULT_CRON = "0 0 * * *"; // chạy lúc 00:00 mỗi ngày
const DEFAULT_TIMEZONE = "UTC";

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
    const privateKey =
        process.env.MARK_FAILED_PRIVATE_KEY ||
        process.env.PRIVATE_KEY ||
        process.env.DEPLOYER_PRIVATE_KEY;

    if (!resolved || !privateKey) {
        console.warn(
            "[listener-service] markAsFailed job bị tắt (thiếu contract config hoặc private key).",
        );
        return;
    }

    const provider = new ethers.JsonRpcProvider(resolved.rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);
    const readContract = new ethers.Contract(
        resolved.contractAddress,
        CONTRACT_ABI,
        provider,
    );
    const writeContract = new ethers.Contract(
        resolved.contractAddress,
        CONTRACT_ABI,
        wallet,
    );

    const nowSec = Math.floor(Date.now() / 1000);
    const campaignCount = Number(await readContract.campaignCount());

    if (!campaignCount) {
        console.log(
            "[listener-service] markAsFailed job: không có campaign nào.",
        );
        return;
    }

    let updatedCount = 0;

    for (let campaignId = 1; campaignId <= campaignCount; campaignId += 1) {
        try {
            const campaign = await readContract.getCampaign(BigInt(campaignId));
            if (!isCampaignFailedByRule(campaign, nowSec)) continue;

            const tx = await writeContract.markAsFailed(BigInt(campaignId));
            console.log(
                `[listener-service] markAsFailed tx sent: campaignId=${campaignId}, tx=${tx.hash}`,
            );
            await tx.wait();
            updatedCount += 1;

            // 1. Publish campaign.failed → campaign-service cập nhật status + gửi notification
            const mqChannel = getChannel();
            if (mqChannel) {
                mqChannel.publish(
                    EXCHANGE,
                    process.env.RABBITMQ_RKEY_CAMP_FAILED || "campaign.failed",
                    Buffer.from(
                        JSON.stringify({
                            campaignOnChainId: Number(campaignId),
                            txHash: tx.hash,
                        }),
                    ),
                    { persistent: true },
                );
            }

            // 2. Upsert tx markAsFailed vào transaction-service
            try {
                const walletAddr = await wallet.getAddress();
                await axios.post(
                    `${process.env.TRANSACTION_SERVICE_URL}/api/transactions/internal/upsert`,
                    {
                        txHash: tx.hash,
                        walletAddress: walletAddr,
                        action: "markAsFailed",
                        campaignOnChainId: Number(campaignId),
                    },
                );
            } catch (upsertErr) {
                console.warn(
                    `[listener-service] markAsFailed: không thể upsert tx campaignId=${campaignId}:`,
                    upsertErr.message,
                );
            }
        } catch (err) {
            const message =
                err?.shortMessage ||
                err?.reason ||
                err?.message ||
                "unknown error";
            console.warn(
                `[listener-service] markAsFailed bỏ qua campaignId=${campaignId}: ${message}`,
            );
        }
    }

    console.log(
        `[listener-service] markAsFailed job hoàn tất. campaigns updated=${updatedCount}`,
    );
}

function startMarkFailedDailyJob() {
    const enabled = process.env.MARK_FAILED_JOB_ENABLED !== "false";
    if (!enabled) {
        console.log(
            "[listener-service] markAsFailed job disabled by MARK_FAILED_JOB_ENABLED=false",
        );
        return null;
    }

    const cronExpression =
        (process.env.MARK_FAILED_JOB_CRON || DEFAULT_CRON).trim() ||
        DEFAULT_CRON;
    const timezone =
        (process.env.MARK_FAILED_JOB_TIMEZONE || DEFAULT_TIMEZONE).trim() ||
        DEFAULT_TIMEZONE;

    if (!cron.validate(cronExpression)) {
        console.error(
            `[listener-service] MARK_FAILED_JOB_CRON không hợp lệ: "${cronExpression}"`,
        );
        return null;
    }

    const safeRun = () =>
        runMarkFailedSweep().catch((err) => {
            console.error(
                "[listener-service] markAsFailed job failed:",
                err?.message || err,
            );
        });

    // Chạy ngay 1 lần lúc startup (giữ hành vi cũ), sau đó theo cron schedule
    safeRun();

    const task = cron.schedule(cronExpression, safeRun, {
        timezone,
    });

    console.log(
        `[listener-service] markAsFailed cron started: expression="${cronExpression}", timezone="${timezone}"`,
    );

    return task;
}

module.exports = { startMarkFailedDailyJob, runMarkFailedSweep };
