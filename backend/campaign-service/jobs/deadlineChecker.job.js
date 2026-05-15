const cron = require("node-cron");
const { Milestone, Campaign } = require("../models");
const { isDeadlineExceeded } = require("../utils/deadlineHelper");
const refundService = require("../services/refundService");
const { publishMilestoneFailed } = require("../utils/publishMilestoneFailed");
const { publishCampaignFailed } = require("../utils/publishCampaignFailed");

function startDeadlineCheckerJob() {
    const expression = process.env.MILESTONE_DEADLINE_CRON || "*/10 * * * *";

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

            // --- Check Campaign Funding Deadlines ---
            const expiredCampaigns = await Campaign.find({
                status: "active",
                deadline: { $lte: now },
            });

            let campaignFailedCount = 0;
            for (const campaign of expiredCampaigns) {
                // If goal is already reached but status is still 'active', it should have been 'in_progress'
                // but we check it here just in case.
                const raised = BigInt(campaign.totalRaisedWei || "0");
                const goal = BigInt(campaign.goalWei || "0");
                
                if (raised >= goal) {
                    // This campaign actually succeeded funding, but indexer might be slow.
                    // We don't mark it as failed.
                    continue;
                }

                console.log(`[deadlineChecker] Campaign ${campaign.onChainId} expired (deadline reached without goal)`);
                
                // We use handleCampaignCascadeFailure from refundService which handles everything
                await refundService.handleCampaignCascadeFailure(campaign.onChainId);
                
                await publishCampaignFailed({
                    campaignOnChainId: campaign.onChainId,
                    reason: "funding_deadline_not_reached_goal",
                    markedBy: "system",
                    txHash: null
                });
                
                campaignFailedCount += 1;
            }

            if (campaignFailedCount > 0) {
                console.log(`[deadlineChecker] Marked ${campaignFailedCount} campaigns as failed due to expiration`);
            }
        } catch (error) {
            console.error(`[deadlineChecker] Error: ${error.message}`);
        }
    });

    console.log(`[deadlineChecker] Started with cron '${expression}'`);
}

module.exports = { startDeadlineCheckerJob };
