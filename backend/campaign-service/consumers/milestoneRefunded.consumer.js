const { getChannel, EXCHANGE } = require("../config/rabbitmq");
const { Campaign, CampaignRefund } = require("../models");
const { recordTransaction } = require("../utils/recordTransaction");

const QUEUE =
    process.env.RABBITMQ_QUEUE_MILESTONE_REFUNDED || "milestone.refunded.queue";
const ROUTING_KEY =
    process.env.RABBITMQ_RKEY_MILESTONE_REFUNDED || "milestone.refunded";

async function startMilestoneRefundedConsumer() {
    const channel = getChannel();
    if (!channel) {
        console.warn(
            "[campaign-service] RabbitMQ channel unavailable. Skip milestone.refunded consumer",
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
                payload.campaignOnChainId ?? payload.campaignId,
            );
            const refundType = (payload.refundType || "milestone")
                .toString()
                .toLowerCase();
            const isFundingRefund = refundType === "funding";
            const milestoneId = isFundingRefund
                ? null
                : Number(payload.milestoneId);
            const donorAddress = (payload.donor || payload.donorAddress || "")
                .toString()
                .toLowerCase();
            const amountWei = (
                payload.amountWei ||
                payload.refundedWei ||
                "0"
            ).toString();

            if (
                !Number.isFinite(campaignOnChainId) ||
                (!isFundingRefund && !Number.isFinite(milestoneId)) ||
                !donorAddress
            ) {
                throw new Error(
                    "Missing campaignId/milestoneId/donor in milestone.refunded payload",
                );
            }

            const campaign = await Campaign.findOne({
                onChainId: campaignOnChainId,
            });

            await CampaignRefund.findOneAndUpdate(
                {
                    campaignOnChainId,
                    milestoneId,
                    donorAddress,
                },
                {
                    $set: {
                        campaignId: campaign?._id,
                        campaignOnChainId,
                        milestoneId,
                        donorAddress,
                        amountWei,
                        eligibleRefundWei: amountWei,
                        refundedWei: amountWei,
                        status: "refunded",
                        claimedAt: new Date(),
                        refundedAt: new Date(),
                        refundTxHash: payload.txHash || null,
                    },
                },
                {
                    upsert: true,
                    new: true,
                    setDefaultsOnInsert: true,
                },
            );

            await recordTransaction({
                txHash: payload.txHash,
                walletAddress: donorAddress,
                action: isFundingRefund
                    ? "claimFundingRefund"
                    : "claimMilestoneRefund",
                campaignOnChainId,
            });

            channel.ack(msg);
        } catch (error) {
            console.error(
                "[campaign-service] milestoneRefunded consumer error:",
                error.message,
            );
            channel.nack(msg, false, false);
        }
    });
}

module.exports = { startMilestoneRefundedConsumer };
