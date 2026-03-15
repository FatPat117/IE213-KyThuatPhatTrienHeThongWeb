const cron = require("node-cron");
const mongoose = require("mongoose");
const { ethers } = require("ethers");
const { CONTRACT_ABI, resolveContractConfig } = require("../config/contract");

const JOB_NAME = "markAsFailed";
const DEFAULT_CRON_EXPRESSION = "*/1 * * * *";
const DEFAULT_BATCH_SIZE = 50;

const CampaignSchema = new mongoose.Schema(
    {
        onChainId: { type: Number, required: true, unique: true },
        goal: { type: String, required: true, default: "0" },
        raised: { type: String, required: true, default: "0" },
        deadline: { type: Date, required: true },
        status: {
            type: String,
            enum: [
                "active",
                "processing_failure",
                "failed",
                "ended",
                "cancelled",
            ],
            default: "active",
            index: true,
        },
        processingStartedAt: { type: Date, default: null },
        markFailedTxHash: { type: String, default: null },
        markFailedAt: { type: Date, default: null },
        markFailedError: { type: String, default: "" },
    },
    {
        collection: "campaigns",
        strict: false,
    },
);

CampaignSchema.index({ status: 1, deadline: 1 });

const Campaign =
    mongoose.models.Campaign || mongoose.model("Campaign", CampaignSchema);

let cronTask = null;
let isTickRunning = false;
let mongoReadyPromise = null;

function toPositiveInt(value, fallback) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    return parsed;
}

async function ensureMongoConnection() {
    if (mongoose.connection.readyState === 1) {
        return;
    }

    if (!mongoReadyPromise) {
        const mongoUri = process.env.MONGO_URI;
        if (!mongoUri) {
            throw new Error(
                "MONGO_URI is missing. Cannot run markAsFailed scheduler.",
            );
        }

        mongoReadyPromise = mongoose
            .connect(mongoUri, {
                serverSelectionTimeoutMS: 10000,
                maxPoolSize: 10,
            })
            .then(() => {
                console.log(
                    `[listener-service] ${JOB_NAME} scheduler connected to MongoDB.`,
                );
            })
            .catch((err) => {
                mongoReadyPromise = null;
                throw err;
            });
    }

    await mongoReadyPromise;
}

function buildFailureEligibilityQuery(now) {
    return {
        deadline: { $lt: now },
        status: "active",
        $expr: {
            $lt: [
                {
                    $convert: {
                        input: "$raised",
                        to: "decimal",
                        onError: { $literal: "0" },
                        onNull: { $literal: "0" },
                    },
                },
                {
                    $convert: {
                        input: "$goal",
                        to: "decimal",
                        onError: { $literal: "0" },
                        onNull: { $literal: "0" },
                    },
                },
            ],
        },
    };
}

async function lockCampaignForProcessing(campaignId, now) {
    const filter = {
        _id: campaignId,
        ...buildFailureEligibilityQuery(now),
    };

    const update = {
        $set: {
            status: "processing_failure",
            processingStartedAt: new Date(),
            markFailedError: "",
        },
    };

    return Campaign.findOneAndUpdate(filter, update, {
        new: true,
    }).lean();
}

function safeErrorMessage(err) {
    const message =
        err?.shortMessage ||
        err?.reason ||
        err?.message ||
        "Unknown markAsFailed error";
    return String(message).slice(0, 1000);
}

async function processOneCampaign(campaign, writeContract) {
    const campaignLabel = `campaignOnChainId=${campaign.onChainId}`;

    try {
        console.log(
            `[listener-service] ${JOB_NAME} tx submit started for ${campaignLabel}.`,
        );
        const tx = await writeContract.markAsFailed(BigInt(campaign.onChainId));
        console.log(
            `[listener-service] ${JOB_NAME} tx submitted for ${campaignLabel}: txHash=${tx.hash}`,
        );

        const receipt = await tx.wait();
        if (!receipt || Number(receipt.status) !== 1) {
            throw new Error("Transaction receipt status is not successful");
        }

        await Campaign.updateOne(
            { _id: campaign._id, status: "processing_failure" },
            {
                $set: {
                    status: "failed",
                    markFailedTxHash: tx.hash,
                    markFailedAt: new Date(),
                    markFailedError: "",
                },
            },
        );

        console.log(
            `[listener-service] ${JOB_NAME} tx confirmed for ${campaignLabel}: txHash=${tx.hash}, blockNumber=${receipt.blockNumber}.`,
        );
    } catch (err) {
        const message = safeErrorMessage(err);

        await Campaign.updateOne(
            { _id: campaign._id, status: "processing_failure" },
            {
                $set: {
                    status: "active",
                    markFailedError: message,
                },
            },
        );

        console.error(
            `[listener-service] ${JOB_NAME} failed for ${campaignLabel}. Status reset to active. Reason=${message}`,
        );
    }
}

async function runMarkFailedSweep() {
    const resolved = resolveContractConfig();
    const adminPrivateKey = process.env.ADMIN_PRIVATE_KEY;

    if (!resolved) {
        console.warn(
            `[listener-service] ${JOB_NAME} scheduler skipped: contract configuration is missing.`,
        );
        return;
    }

    if (!adminPrivateKey) {
        console.warn(
            `[listener-service] ${JOB_NAME} scheduler skipped: ADMIN_PRIVATE_KEY is missing.`,
        );
        return;
    }

    await ensureMongoConnection();

    const now = new Date();
    const batchSize = toPositiveInt(
        process.env.MARK_FAILED_BATCH_SIZE,
        DEFAULT_BATCH_SIZE,
    );

    const eligibleCampaigns = await Campaign.find(
        buildFailureEligibilityQuery(now),
    )
        .sort({ deadline: 1, _id: 1 })
        .limit(batchSize)
        .select({
            _id: 1,
            onChainId: 1,
            goal: 1,
            raised: 1,
            deadline: 1,
            status: 1,
        })
        .lean();

    if (eligibleCampaigns.length === 0) {
        console.log(
            `[listener-service] ${JOB_NAME} sweep completed: no eligible campaigns found.`,
        );
        return;
    }

    console.log(
        `[listener-service] ${JOB_NAME} sweep found ${eligibleCampaigns.length} eligible campaign(s).`,
    );

    const provider = new ethers.JsonRpcProvider(resolved.rpcUrl);
    const wallet = new ethers.Wallet(adminPrivateKey, provider);
    const writeContract = new ethers.Contract(
        resolved.contractAddress,
        CONTRACT_ABI,
        wallet,
    );

    let lockedCount = 0;

    for (const candidate of eligibleCampaigns) {
        const lockedCampaign = await lockCampaignForProcessing(
            candidate._id,
            now,
        );
        if (!lockedCampaign) {
            console.log(
                `[listener-service] ${JOB_NAME} lock skipped for campaignOnChainId=${candidate.onChainId}: already processed by another worker or state changed.`,
            );
            continue;
        }

        lockedCount += 1;
        await processOneCampaign(lockedCampaign, writeContract);
    }

    console.log(
        `[listener-service] ${JOB_NAME} sweep finished. eligible=${eligibleCampaigns.length}, locked=${lockedCount}.`,
    );
}

async function safeRunSweep() {
    if (isTickRunning) {
        console.log(
            `[listener-service] ${JOB_NAME} tick skipped because the previous tick is still running.`,
        );
        return;
    }

    isTickRunning = true;
    const startedAt = Date.now();

    try {
        await runMarkFailedSweep();
    } catch (err) {
        console.error(
            `[listener-service] ${JOB_NAME} sweep crashed: ${safeErrorMessage(err)}`,
        );
    } finally {
        const durationMs = Date.now() - startedAt;
        console.log(
            `[listener-service] ${JOB_NAME} tick completed in ${durationMs} ms.`,
        );
        isTickRunning = false;
    }
}

function startMarkFailedDailyJob() {
    const enabled = process.env.MARK_FAILED_JOB_ENABLED !== "false";
    if (!enabled) {
        console.log(
            `[listener-service] ${JOB_NAME} scheduler disabled by MARK_FAILED_JOB_ENABLED=false.`,
        );
        return null;
    }

    const cronExpression =
        process.env.MARK_FAILED_CRON || DEFAULT_CRON_EXPRESSION;

    if (!cron.validate(cronExpression)) {
        throw new Error(
            `[listener-service] Invalid MARK_FAILED_CRON expression: ${cronExpression}`,
        );
    }

    console.log(
        `[listener-service] ${JOB_NAME} scheduler started with cron="${cronExpression}".`,
    );

    cronTask = cron.schedule(
        cronExpression,
        () => {
            safeRunSweep().catch((err) => {
                console.error(
                    `[listener-service] ${JOB_NAME} unexpected scheduler failure: ${safeErrorMessage(err)}`,
                );
            });
        },
        {
            timezone: process.env.MARK_FAILED_CRON_TIMEZONE || "UTC",
        },
    );

    safeRunSweep().catch((err) => {
        console.error(
            `[listener-service] ${JOB_NAME} bootstrap sweep failed: ${safeErrorMessage(err)}`,
        );
    });

    return cronTask;
}

function stopMarkFailedJob() {
    if (cronTask) {
        cronTask.stop();
        cronTask = null;
        console.log(`[listener-service] ${JOB_NAME} scheduler stopped.`);
    }
}

module.exports = {
    startMarkFailedDailyJob,
    runMarkFailedSweep,
    stopMarkFailedJob,
};
