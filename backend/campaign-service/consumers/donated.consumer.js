const { getChannel } = require("../config/rabbitmq");
const Campaign = require("../models/Campaign.model");

const QUEUE =
    process.env.RABBITMQ_QUEUE_CAMP_DONATED || "campaign.donation.queue";
const ROUTING_KEY = process.env.RABBITMQ_RKEY_DONATED || "donation.received";
const DONATION_EXCHANGE = process.env.RABBITMQ_EXCHANGE || "funding.events";

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
            const campaignOnChainId = Number(
                payload.campaignOnChainId || payload.campaignId,
            );
            const donationAmount = BigInt(payload.amount || "0");
            const totalRaisedFromEvent = payload.totalRaisedWei
                ? payload.totalRaisedWei.toString()
                : null;

            if (campaignOnChainId === undefined || campaignOnChainId === null) {
                throw new Error(
                    "Missing campaignOnChainId in donation payload",
                );
            }

            if (donationAmount <= 0n && !totalRaisedFromEvent) {
                throw new Error("Missing amount in donation payload");
            }

            const campaign = await Campaign.findOne({
                onChainId: campaignOnChainId,
            });

            if (!campaign) {
                console.warn(
                    `[campaign-service] Campaign not found for donation event. onChainId=${campaignOnChainId}`,
                );
                channel.ack(msg);
                return;
            }

            const nextRaised = totalRaisedFromEvent
                ? totalRaisedFromEvent
                : (BigInt(campaign.totalRaisedWei || "0") + donationAmount).toString();

            campaign.totalRaisedWei = nextRaised;
            campaign.raised = nextRaised;
            await campaign.save();

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
