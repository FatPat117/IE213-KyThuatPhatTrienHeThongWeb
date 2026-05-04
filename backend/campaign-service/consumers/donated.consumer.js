const { getChannel } = require("../config/rabbitmq");
const { Campaign, CampaignDonorShare, CampaignDonation } = require("../models");

const QUEUE =
    process.env.RABBITMQ_QUEUE_CAMP_DONATED || "campaign.donation.queue";
const ROUTING_KEY = process.env.RABBITMQ_RKEY_DONATED || "donation.received";
const DONATION_EXCHANGE = process.env.RABBITMQ_EXCHANGE || "funding.events";

function parseWei(value) {
    try {
        return BigInt((value || "0").toString());
    } catch {
        return 0n;
    }
}

async function upsertDonorShare({
    campaign,
    campaignOnChainId,
    donorWallet,
    donationAmountWei,
    campaignTotalRaisedWei,
}) {
    const existingShare = await CampaignDonorShare.findOne({
        campaignId: campaign._id,
        donorAddress: donorWallet,
    });

    const currentTotalWei = parseWei(existingShare?.donorTotalContributionWei);
    const nextTotalWei = (currentTotalWei + donationAmountWei).toString();

    await CampaignDonorShare.findOneAndUpdate(
        {
            campaignId: campaign._id,
            donorAddress: donorWallet,
        },
        {
            $set: {
                campaignId: campaign._id,
                campaignOnChainId,
                donorAddress: donorWallet,
                donorTotalContributionWei: nextTotalWei,
                campaignTotalRaisedWei: campaignTotalRaisedWei.toString(),
                computedAt: new Date(),
            },
            $setOnInsert: {
                donorShareInCampaignBps: 0,
            },
        },
        {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true,
        },
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
            const campaignOnChainId = Number(
                payload.campaignOnChainId ?? payload.campaignId,
            );
            const donorWallet = (payload.donorWallet || payload.donor || "")
                .toString()
                .toLowerCase();
            const donationAmount = parseWei(payload.amount);
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

            if (!donorWallet) {
                throw new Error("Missing donorWallet in donation payload");
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
                : (
                      BigInt(campaign.totalRaisedWei || "0") + donationAmount
                  ).toString();

            campaign.totalRaisedWei = nextRaised;
            campaign.raised = nextRaised;
            await campaign.save();

            if (donationAmount > 0n) {
                // 1. Cập nhật phần chia của Donor
                await upsertDonorShare({
                    campaign,
                    campaignOnChainId,
                    donorWallet,
                    donationAmountWei: donationAmount,
                    campaignTotalRaisedWei: nextRaised,
                });

                // 2. Lưu lịch sử quyên góp chi tiết (Để hiện trên UI)
                await CampaignDonation.create({
                    campaignId: campaign._id,
                    campaignOnChainId,
                    donorAddress: donorWallet,
                    amountWei: donationAmount.toString(),
                    txHash: payload.txHash || "",
                    donatedAt: new Date(),
                });
            }

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
