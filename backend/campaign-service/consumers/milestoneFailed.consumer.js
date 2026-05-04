const { getChannel, EXCHANGE } = require("../config/rabbitmq");
const { Milestone } = require("../models");
const { recordTransaction } = require("../utils/recordTransaction");

const QUEUE =
    process.env.RABBITMQ_QUEUE_MILESTONE_FAILED || "milestone.failed.queue";
const ROUTING_KEY =
    process.env.RABBITMQ_RKEY_MILESTONE_FAILED || "blockchain.milestone.failed";

async function startMilestoneFailedConsumer() {
    const channel = getChannel();
    if (!channel) {
        console.warn(
            "[campaign-service] RabbitMQ channel unavailable. Skip milestone.failed consumer",
        );
        return;
    }

    await channel.assertQueue(QUEUE, { durable: true });
    await channel.bindQueue(QUEUE, EXCHANGE, ROUTING_KEY);
    channel.prefetch(1);

    console.log(
        `[campaign-service] Listening for ${ROUTING_KEY} on queue: ${QUEUE}`,
    );

    channel.consume(QUEUE, async (msg) => {
        if (!msg) return;

        try {
            const payload = JSON.parse(msg.content.toString());
            const campaignOnChainId = Number(
                payload.campaignId || payload.campaignOnChainId,
            );
            const milestoneId = Number(payload.milestoneId);

            if (!campaignOnChainId || Number.isNaN(milestoneId)) {
                throw new Error(
                    "Missing campaignId/milestoneId in milestone.failed payload",
                );
            }

            await Milestone.updateOne(
                { campaignOnChainId, milestoneId },
                {
                    $set: {
                        status: "failed",
                        failedAt: new Date(),
                    },
                },
            );

            // Call handleCampaignCascadeFailure to ensure campaign also fails and refunds are created
            const { handleCampaignCascadeFailure } = require("../services/refundService");
            await handleCampaignCascadeFailure(campaignOnChainId);

            await recordTransaction({
                txHash: payload.txHash,
                walletAddress: payload.markedBy,
                action: "milestoneFail",
                campaignOnChainId,
            });

            channel.ack(msg);
        } catch (error) {
            console.error(
                "[campaign-service] milestoneFailed consumer error:",
                error.message,
            );
            channel.nack(msg, false, false);
        }
    });
}

module.exports = { startMilestoneFailedConsumer };
