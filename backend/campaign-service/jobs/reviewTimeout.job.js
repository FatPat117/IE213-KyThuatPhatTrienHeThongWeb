const cron = require("node-cron");
const { Milestone } = require("../models");
const refundService = require("../services/refundService");
const { publishMilestoneFailed } = require("../utils/publishMilestoneFailed");

const REVIEW_TIMEOUT_DAYS = Number(process.env.REVIEW_TIMEOUT_DAYS || 7);

function startReviewTimeoutJob() {
    const expression = process.env.REVIEW_TIMEOUT_CRON || "0 * * * *";

    cron.schedule(expression, async () => {
        try {
            const threshold = new Date(
                Date.now() - REVIEW_TIMEOUT_DAYS * 24 * 60 * 60 * 1000,
            );

            const candidates = await Milestone.find({
                status: { $in: ["submitted", "pending_verification"] },
                submittedAt: { $ne: null, $lt: threshold },
            });

            let timedOutCount = 0;
            for (const milestone of candidates) {
                milestone.status = "review_timeout";
                milestone.failureReason = "REVIEW_TIMEOUT";
                milestone.reviewTimeoutAt = new Date();
                await milestone.save();

                const published = await publishMilestoneFailed({
                    campaignId: milestone.campaignOnChainId,
                    milestoneId: milestone.milestoneIndex,
                    markedBy: "system",
                    amount: milestone.financialTargetWei || "0",
                    txHash: null,
                    logIndex: -1,
                    blockNumber: -1,
                    reason: "REVIEW_TIMEOUT",
                });

                // fallback path if RabbitMQ publisher unavailable
                if (!published) {
                    await refundService.handleCampaignCascadeFailure(
                        milestone.campaignOnChainId,
                    );
                }
                timedOutCount += 1;
            }

            if (timedOutCount > 0) {
                console.log(
                    `[reviewTimeout] Marked ${timedOutCount} milestones as review_timeout`,
                );
            }
        } catch (error) {
            console.error(`[reviewTimeout] Error: ${error.message}`);
        }
    });

    console.log(`[reviewTimeout] Started with cron '${expression}'`);
}

module.exports = { startReviewTimeoutJob, REVIEW_TIMEOUT_DAYS };
