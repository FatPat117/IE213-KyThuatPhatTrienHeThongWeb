const { getChannel, EXCHANGE } = require("../config/rabbitmq");
const { Campaign, CampaignDonorShare, Donation } = require("../models");

const QUEUE =
    process.env.RABBITMQ_QUEUE_FUNDING_COMPLETE ||
    "campaign.funding.completed.queue";
const ROUTING_KEY =
    process.env.RABBITMQ_RKEY_FUNDING_COMPLETE || "campaign.funding.completed";

async function startFundingCompleteConsumer() {
    const channel = getChannel();
    if (!channel) {
        console.warn(
            "[campaign-service] RabbitMQ channel unavailable. Skip funding complete consumer",
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
                payload.campaignOnChainId || payload.campaignId,
            );

            if (!campaignOnChainId) {
                throw new Error("Missing campaignOnChainId in funding complete payload");
            }

            const campaign = await Campaign.findOne({ onChainId: campaignOnChainId });
            if (!campaign) {
                throw new Error(
                    `Campaign not found for funding complete: onChainId=${campaignOnChainId}`,
                );
            }

            const totalRaisedWei = (
                payload.totalRaisedWei || campaign.totalRaisedWei || "0"
            ).toString();

            campaign.status = "in_progress";
            campaign.totalRaisedWei = totalRaisedWei;
            campaign.raised = totalRaisedWei;
            await campaign.save();

            const donations = await Donation.find({ campaignOnChainId });
            const donorTotals = new Map();

            for (const donation of donations) {
                const donor = (donation.donorWallet || "").toLowerCase();
                if (!donor) continue;

                const current = donorTotals.get(donor) || 0n;
                donorTotals.set(
                    donor,
                    current + BigInt(donation.amount || "0"),
                );
            }

            const totalRaised = BigInt(totalRaisedWei);
            const shareOps = [];
            for (const [donorAddress, donorAmount] of donorTotals.entries()) {
                const shareBps =
                    totalRaised > 0n
                        ? Number((donorAmount * 10_000n) / totalRaised)
                        : 0;

                shareOps.push({
                    updateOne: {
                        filter: {
                            campaignOnChainId,
                            donorAddress,
                        },
                        update: {
                            $set: {
                                campaignId: campaign._id,
                                campaignOnChainId,
                                donorAddress,
                                donorTotalContributionWei: donorAmount.toString(),
                                campaignTotalRaisedWei: totalRaisedWei,
                                donorShareInCampaignBps: shareBps,
                                computedAt: new Date(),
                            },
                        },
                        upsert: true,
                    },
                });
            }

            if (shareOps.length > 0) {
                await CampaignDonorShare.bulkWrite(shareOps, {
                    ordered: false,
                });
            }

            channel.ack(msg);
        } catch (error) {
            console.error(
                "[campaign-service] fundingCompleteConsumer error:",
                error.message,
            );
            channel.nack(msg, false, false);
        }
    });
}

module.exports = {
    startFundingCompleteConsumer,
};
