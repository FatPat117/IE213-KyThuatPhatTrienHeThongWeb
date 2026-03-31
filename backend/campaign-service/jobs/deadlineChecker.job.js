const cron = require("node-cron");
const { Milestone } = require("../models");
const { isDeadlineExceeded } = require("../utils/deadlineHelper");
const refundService = require("../services/refundService");
const { publishMilestoneFailed } = require("../utils/publishMilestoneFailed");

function startDeadlineCheckerJob() {
    const expression = process.env.MILESTONE_DEADLINE_CRON || "0 0 * * *";

    cron.schedule(expression, async () => {
        try {
            const now = new Date();
            const candidates = await Milestone.find({
                status: { $in: ["pending_funding", "resubmittable"] },
            });

            let failedCount = 0;
            for (const milestone of candidates) {
                if (!isDeadlineExceeded(milestone.deadline)) {
                    continue;
                }

                milestone.status = "deadline_exceeded";
                milestone.failureReason = "DEADLINE_EXCEEDED";
                milestone.deadlineExceededAt = now;
                await milestone.save();

                const published = await publishMilestoneFailed({
                    campaignId: milestone.campaignOnChainId,
                    milestoneId: milestone.milestoneIndex,
                    markedBy: "system",
                    amount: milestone.financialTargetWei || "0",
                    txHash: null,
                    logIndex: -1,
                    blockNumber: -1,
                    reason: "DEADLINE_EXCEEDED",
                });

                // fallback path if RabbitMQ publisher unavailable
                if (!published) {
                    await refundService.handleCampaignCascadeFailure(
                        milestone.campaignOnChainId,
                    );
                }
                failedCount += 1;
            }

            if (failedCount > 0) {
                console.log(
                    `[deadlineChecker] Marked ${failedCount} milestones as deadline_exceeded`,
                );
            }
        } catch (error) {
            console.error(`[deadlineChecker] Error: ${error.message}`);
        }
    });

    console.log(`[deadlineChecker] Started with cron '${expression}'`);
}

module.exports = { startDeadlineCheckerJob };
