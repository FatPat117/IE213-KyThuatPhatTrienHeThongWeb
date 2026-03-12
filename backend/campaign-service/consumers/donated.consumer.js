const { getChannel } = require("../config/rabbitmq");
const Campaign = require("../models/Campaign.model");

const QUEUE =
    process.env.RABBITMQ_QUEUE_CAMP_DONATED || "campaign.donation.queue";
const ROUTING_KEY = process.env.RABBITMQ_RKEY_DONATED || "donation.received";
const DONATION_EXCHANGE = process.env.RABBITMQ_EXCHANGE || "funding.events";
const MAX_UPDATE_RETRIES = 5;

async function applyDonationAtomically(campaignOnChainId, amount) {
    const normalizedCampaignId = Number(campaignOnChainId);
    const donationAmount = BigInt(amount);

    for (let attempt = 1; attempt <= MAX_UPDATE_RETRIES; attempt += 1) {
        const campaign = await Campaign.findOne({
            onChainId: normalizedCampaignId,
        });

        if (!campaign) {
            return null;
        }

        const currentRaised = BigInt(campaign.raised || "0");
        const goalAmount = BigInt(campaign.goal || "0");
        const newRaised = (currentRaised + donationAmount).toString();
        const nextStatus =
            currentRaised + donationAmount >= goalAmount
                ? "ended"
                : campaign.status;

        const updateResult = await Campaign.updateOne(
            {
                _id: campaign._id,
                raised: campaign.raised,
                status: campaign.status,
            },
            {
                $set: {
                    raised: newRaised,
                    status: nextStatus,
                },
            },
        );

        if (updateResult.modifiedCount === 1) {
            return {
                onChainId: normalizedCampaignId,
                raised: newRaised,
                status: nextStatus,
            };
        }
    }

    throw new Error(
        `Failed to apply donation for campaign ${normalizedCampaignId} after ${MAX_UPDATE_RETRIES} concurrent update retries`,
    );
}

async function startDonatedConsumer() {
    const channel = getChannel();

    if (!channel) {
        console.warn(
            "[campaign-service] RabbitMQ channel is unavailable. Donation consumer was not started.",
        );
        return;
    }

    await channel.assertQueue(QUEUE, { durable: true });
    await channel.bindQueue(QUEUE, DONATION_EXCHANGE, ROUTING_KEY);
    channel.prefetch(1);

    console.log(
        `[campaign-service] Listening for donation events on queue: ${QUEUE}`,
    );

    channel.consume(QUEUE, async (msg) => {
        if (!msg) return;

        try {
            const payload = JSON.parse(msg.content.toString());
            const { campaignOnChainId, donorWallet, amount, txHash } = payload;

            if (campaignOnChainId === undefined || campaignOnChainId === null) {
                throw new Error(
                    "Missing campaignOnChainId in donation payload",
                );
            }

            if (!amount) {
                throw new Error("Missing amount in donation payload");
            }

            console.log(
                "[campaign-service] Received donation.received event:",
                {
                    campaignOnChainId,
                    donorWallet,
                    amount,
                    txHash,
                },
            );

            const updatedCampaign = await applyDonationAtomically(
                campaignOnChainId,
                amount,
            );

            if (!updatedCampaign) {
                console.warn(
                    `[campaign-service] Campaign ${campaignOnChainId} was not found. Donation event was acknowledged without a database update.`,
                );
                channel.ack(msg);
                return;
            }

            console.log(
                `[campaign-service] Campaign ${updatedCampaign.onChainId} updated successfully. raised=${updatedCampaign.raised}, status=${updatedCampaign.status}`,
            );

            channel.ack(msg);
        } catch (err) {
            console.error(
                "[campaign-service] Donation consumer error:",
                err.message,
            );
            channel.nack(msg, false, false);
        }
    });
}

module.exports = { startDonatedConsumer };
