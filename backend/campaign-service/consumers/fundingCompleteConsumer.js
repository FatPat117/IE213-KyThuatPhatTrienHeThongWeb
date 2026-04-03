const { getChannel, EXCHANGE } = require("../config/rabbitmq");
const { Campaign, CampaignDonorShare } = require("../models");

const QUEUE =
    process.env.RABBITMQ_QUEUE_FUNDING_COMPLETE ||
    "campaign.funding.completed.queue";
const ROUTING_KEY =
    process.env.RABBITMQ_RKEY_FUNDING_COMPLETE || "campaign.funding.completed";

function parseOnChainId(event) {
    const rawId = event?.campaignId ?? event?.campaignOnChainId;
    const parsed = Number(rawId);

    if (!Number.isFinite(parsed)) {
        throw new Error(
            "Missing or invalid campaignId in funding.complete payload",
        );
    }

    return parsed;
}

function parseFundingCompletedAt(goalReachedAt) {
    if (
        goalReachedAt === undefined ||
        goalReachedAt === null ||
        goalReachedAt === ""
    ) {
        return new Date();
    }

    const value = Number(goalReachedAt);
    if (!Number.isFinite(value)) {
        return new Date();
    }

    if (value > 1_000_000_000_000) {
        return new Date(value);
    }

    return new Date(value * 1000);
}

function toWeiBigInt(value) {
    try {
        return BigInt((value || "0").toString());
    } catch {
        return 0n;
    }
}

async function getCampaignDonorShares(campaign) {
    let donorShares = await CampaignDonorShare.find({
        campaignId: campaign._id,
    });

    if (!donorShares.length) {
        donorShares = await CampaignDonorShare.find({
            campaignOnChainId: campaign.onChainId,
        });
    }

    return donorShares;
}

async function startFundingCompleteConsumer() {
    const channel = getChannel();

    if (!channel) {
        console.error(
            "[campaign-service] RabbitMQ channel unavailable. Cannot start consumer.",
        );
        return;
    }

    try {
        await channel.assertQueue(QUEUE, { durable: true });
        await channel.bindQueue(QUEUE, EXCHANGE, ROUTING_KEY);
        await channel.prefetch(1);

        console.log(
            `[campaign-service] Listening for ${ROUTING_KEY} on ${QUEUE}...`,
        );

        await channel.consume(QUEUE, async (msg) => {
            if (msg !== null) {
                try {
                    const content = JSON.parse(msg.content.toString());
                    await handleFundingCompleteEvent(content);
                    channel.ack(msg);
                } catch (error) {
                    console.error(
                        `[fundingCompleteConsumer] Failed to process message: ${error.message}. Nacking...`,
                    );
                    channel.nack(msg, false, false);
                }
            }
        });
    } catch (error) {
        console.error(
            `[fundingCompleteConsumer] Startup error: ${error.message}`,
        );
    }
}

async function handleFundingCompleteEvent(event) {
    const { totalRaisedWei, goalReachedAt, transactionHash } = event;
    const campaignOnChainId = parseOnChainId(event);
    const normalizedTotalRaisedWei = (totalRaisedWei || "0").toString();
    const totalRaised = toWeiBigInt(normalizedTotalRaisedWei);

    console.log(
        `[fundingCompleteConsumer] Processing: campaignOnChainId=${campaignOnChainId}`,
    );

    const campaign = await Campaign.findOne({ onChainId: campaignOnChainId });

    if (!campaign) {
        throw new Error(
            `Campaign not found for onChainId: ${campaignOnChainId}`,
        );
    }

    const donorShares = await getCampaignDonorShares(campaign);
    if (!donorShares.length) {
        console.warn(
            `[fundingCompleteConsumer] No CampaignDonorShare snapshots found for campaign=${campaignOnChainId}.`,
        );
    }

    if (donorShares.length && totalRaised > 0n) {
        const computedAt = new Date();
        await CampaignDonorShare.bulkWrite(
            donorShares.map((share) => {
                const donorTotal = toWeiBigInt(share.donorTotalContributionWei);
                const shareBps = Number((donorTotal * 10_000n) / totalRaised);

                return {
                    updateOne: {
                        filter: { _id: share._id },
                        update: {
                            $set: {
                                campaignTotalRaisedWei:
                                    normalizedTotalRaisedWei,
                                donorShareInCampaignBps: shareBps,
                                computedAt,
                            },
                        },
                    },
                };
            }),
            { ordered: false },
        );
    }

    campaign.status = "in_progress";
    campaign.fundingCompletedAt = parseFundingCompletedAt(goalReachedAt);
    campaign.totalRaisedWei = normalizedTotalRaisedWei;
    campaign.raised = normalizedTotalRaisedWei;
    await campaign.save();

    console.log(
        `[fundingCompleteConsumer] Success tx=${transactionHash || "n/a"} campaign=${campaignOnChainId} donors=${donorShares.length}`,
    );
}

module.exports = {
    startFundingCompleteConsumer,
};
