const { ethers } = require("ethers");
const cron = require("node-cron");
const { CONTRACT_ABI, resolveContractConfig } = require("../config/contract");
const axios = require("axios");

const CAMPAIGN_STATUS_PENDING = 0;
const CAMPAIGN_STATUS_ACTIVE = 1;
const CAMPAIGN_STATUS_IN_PROGRESS = 2;
const MILESTONE_STATUS_PENDING_VERIFICATION = 1;
const MILESTONE_STATUS_FAILED = 4;

const DEFAULT_CRON = "0 0 * * *";
const DEFAULT_TIMEZONE = "UTC";

function shouldMarkCampaignFailed(campaign, nowSec) {
    if (!campaign) return false;
    return (
        Number(campaign.status) === CAMPAIGN_STATUS_ACTIVE &&
        BigInt(campaign.totalRaised) < BigInt(campaign.goal) &&
        Number(campaign.deadline) <= nowSec
    );
}

function shouldMarkMilestoneFailed(campaign, milestone, nowSec) {
    if (!campaign || !milestone) return false;
    return (
        Number(campaign.status) === CAMPAIGN_STATUS_IN_PROGRESS &&
        Number(milestone.status) === MILESTONE_STATUS_PENDING_VERIFICATION &&
        Number(milestone.deadline) < nowSec
    );
}

async function checkBackendMilestoneStatus(campaignOnChainId, milestoneId) {
    const baseUrl = process.env.CAMPAIGN_SERVICE_URL || "http://campaign-service:3001";
    if (!baseUrl) return { shouldSkip: false };

    try {
        const response = await axios.get(
            `${baseUrl}/api/milestones/campaigns/${campaignOnChainId}/${milestoneId}`,
            { timeout: 5000 },
        );
        const milestone = response.data?.data;
        if (!milestone) return { shouldSkip: false };

        // 1. Nếu đã thất bại ở backend (do quá số lần từ chối), PHẢI fail on-chain ngay
        if (milestone.status === "failed") {
            return { shouldSkip: false, forceFail: true };
        }

        // 2. Nếu trạng thái là resubmittable, coi như chưa fail on-chain
        if (milestone.status === "resubmittable") {
            return { shouldSkip: true };
        }

        // 3. Nếu deadline ở backend lớn hơn hiện tại, coi như đã được gia hạn
        if (milestone.deadline) {
            const backendDeadline = new Date(milestone.deadline).getTime() / 1000;
            const now = Date.now() / 1000;
            if (backendDeadline > now) {
                return { shouldSkip: true };
            }
        }

        return { shouldSkip: false };
    } catch (error) {
        console.warn(
            `[listener-service] Failed to check backend for milestone ${milestoneId}: ${error.message}`,
        );
        return { shouldSkip: false };
    }
}

async function runMarkFailedSweep() {
    const resolved = resolveContractConfig();
    const privateKey =
        process.env.MARK_FAILED_PRIVATE_KEY ||
        process.env.PRIVATE_KEY ||
        process.env.DEPLOYER_PRIVATE_KEY;

    if (!resolved || !privateKey) {
        console.warn(
            "[listener-service] mark-failed job disabled (missing contract config or private key).",
        );
        return;
    }

    const providerCandidates = (resolved.rpcUrls || []).map((url, index) => ({
        provider: new ethers.JsonRpcProvider(url, 11155111, {
            staticNetwork: true,
        }),
        priority: index + 1,
        weight: 1,
        stallTimeout: 2000,
    }));
    const provider =
        providerCandidates.length <= 1
            ? providerCandidates[0]?.provider
            : new ethers.FallbackProvider(providerCandidates, undefined, {
                  quorum: 1,
              });
    if (!provider) {
        console.warn(
            "[listener-service] mark-failed job disabled (no RPC provider configured).",
        );
        return;
    }

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
        console.log("[listener-service] mark-failed job: no campaigns found.");
        return;
    }

    let failedCampaignCount = 0;
    let failedMilestoneCount = 0;

    for (let campaignId = 1; campaignId <= campaignCount; campaignId += 1) {
        try {
            const campaign = await readContract.getCampaign(BigInt(campaignId));

            if (shouldMarkCampaignFailed(campaign, nowSec)) {
                const tx = await writeContract.markCampaignFailed(
                    BigInt(campaignId),
                );
                console.log(
                    `[listener-service] markCampaignFailed tx sent: campaignId=${campaignId}, tx=${tx.hash}`,
                );
                await tx.wait();
                failedCampaignCount += 1;
                continue;
            }

            if (Number(campaign.status) !== CAMPAIGN_STATUS_IN_PROGRESS) {
                continue;
            }

            const milestoneCount = Number(campaign.milestoneCount || 0);
            for (
                let milestoneId = 0;
                milestoneId < milestoneCount;
                milestoneId += 1
            ) {
                const milestone = await readContract.getMilestone(
                    BigInt(campaignId),
                    BigInt(milestoneId),
                );

                // Idempotent skip when milestone is already failed.
                if (Number(milestone.status) === MILESTONE_STATUS_FAILED) {
                    continue;
                }

                // Kiểm tra trạng thái Backend
                const backend = await checkBackendMilestoneStatus(campaignId, milestoneId);
                
                // Nếu backend bảo "fail ngay" (do quá số lần từ chối) hoặc (quá hạn on-chain và không được skip)
                const isDeadlineExceededOnChain = shouldMarkMilestoneFailed(campaign, milestone, nowSec);
                const shouldFailOnChain = backend.forceFail || (isDeadlineExceededOnChain && !backend.shouldSkip);

                if (!shouldFailOnChain) {
                    continue;
                }

                const tx = await writeContract.markMilestoneFailed(
                    BigInt(campaignId),
                    BigInt(milestoneId),
                );
                console.log(
                    `[listener-service] markMilestoneFailed tx sent: campaignId=${campaignId}, milestoneId=${milestoneId}, tx=${tx.hash}`,
                );
                await tx.wait();
                failedMilestoneCount += 1;

                // Contract marks campaign as stopped on first failed current milestone.
                // No need to process later milestones for this campaign in the same sweep.
                break;
            }
        } catch (err) {
            const message =
                err?.shortMessage ||
                err?.reason ||
                err?.message ||
                "unknown error";
            console.warn(
                `[listener-service] mark-failed skipped campaignId=${campaignId}: ${message}`,
            );
        }
    }

    console.log(
        `[listener-service] mark-failed job completed. campaignsFailed=${failedCampaignCount}, milestonesFailed=${failedMilestoneCount}`,
    );
}

function startMarkFailedDailyJob() {
    const enabled = process.env.MARK_FAILED_JOB_ENABLED !== "false";
    if (!enabled) {
        console.log(
            "[listener-service] mark-failed job disabled by MARK_FAILED_JOB_ENABLED=false",
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
            `[listener-service] MARK_FAILED_JOB_CRON is invalid: "${cronExpression}"`,
        );
        return null;
    }

    const safeRun = () =>
        runMarkFailedSweep().catch((err) => {
            console.error(
                "[listener-service] mark-failed job failed:",
                err?.message || err,
            );
        });

    // Run one sweep at startup, then schedule by cron.
    safeRun();

    const task = cron.schedule(cronExpression, safeRun, {
        timezone,
    });

    console.log(
        `[listener-service] mark-failed cron started: expression="${cronExpression}", timezone="${timezone}"`,
    );

    return task;
}

module.exports = { startMarkFailedDailyJob, runMarkFailedSweep };
