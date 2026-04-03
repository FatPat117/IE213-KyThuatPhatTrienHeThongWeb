const { getChannel, EXCHANGE } = require("../config/rabbitmq");
const { Campaign, Milestone } = require("../models");
const { recordTransaction } = require("../utils/recordTransaction");

const QUEUE =
    process.env.RABBITMQ_QUEUE_MILESTONE_DISBURSED ||
    "milestone.disbursed.queue";
const ROUTING_KEY =
    process.env.RABBITMQ_RKEY_MILESTONE_DISBURSED || "milestone.disbursed";

async function startMilestoneDisbursedConsumer() {
    const channel = getChannel();
    if (!channel) {
        console.warn(
            "[campaign-service] RabbitMQ channel unavailable. Skip milestone.disbursed consumer",
        );
        return;
    }

    await channel.assertQueue(QUEUE, { durable: true });
    await channel.bindQueue(QUEUE, EXCHANGE, ROUTING_KEY);
    channel.prefetch(1);

    console.log(`[campaign-service] Listening for ${ROUTING_KEY} on queue: ${QUEUE}`);

    channel.consume(QUEUE, async (msg) => {
        if (!msg) return;

        try {
            const payload = JSON.parse(msg.content.toString());
            const campaignOnChainId = Number(payload.campaignId || payload.campaignOnChainId);
            const milestoneId = Number(payload.milestoneId);
            const amountWei = BigInt(payload.amountWei || "0");

            if (!campaignOnChainId || Number.isNaN(milestoneId)) {
                throw new Error("Missing campaignId/milestoneId in milestone.disbursed payload");
            }

            await Milestone.updateOne(
                { campaignOnChainId, milestoneId },
                {
                    $set: {
                        status: "disbursed",
                        disbursedAt: new Date(),
                    },
                },
            );

            const campaign = await Campaign.findOne({ onChainId: campaignOnChainId });
            if (campaign) {
                const currentDisbursed = BigInt(campaign.totalDisbursedWei || "0");
                campaign.totalDisbursedWei = (currentDisbursed + amountWei).toString();
                campaign.currentMilestoneId = milestoneId + 1;

                if (
                    campaign.currentMilestoneId >= Number(campaign.milestoneCount) &&
                    campaign.status !== "partial_failed"
                ) {
                    campaign.status = "completed";
                }

                await campaign.save();
            }

            await recordTransaction({
                txHash: payload.txHash,
                walletAddress: payload.beneficiary,
                action: "milestoneDisburse",
                campaignOnChainId,
            });

            channel.ack(msg);
        } catch (error) {
            console.error(
                "[campaign-service] milestoneDisbursed consumer error:",
                error.message,
            );
            channel.nack(msg, false, false);
        }
    });
}

module.exports = { startMilestoneDisbursedConsumer };
