const amqp = require("amqplib");
const { Campaign, Milestone } = require("../models");
const allocationService = require("../services/allocationService");

/**
 * FundingComplete Event Consumer
 * Listens for FundingComplete events and computes allocation for all donors
 *
 * Flow:
 * 1. Receive FundingComplete event from RabbitMQ
 * 2. Fetch campaign and associated milestones
 * 3. Fetch donor contribution data (from donation-service or cached)
 * 4. Compute allocation using BigInt arithmetic
 * 5. Persist CampaignDonorShare snapshot records
 * 6. Update Campaign.lifecycleStatus = 'funding_complete'
 * 7. Acknowledge message (idempotent by unique key)
 */

const RABBITMQ_CONFIG = {
    URL: process.env.RABBITMQ_URL || "amqp://localhost",
    EXCHANGE: process.env.RABBITMQ_EXCHANGE || "campaign.events",
    ROUTING_KEY: "campaign.fundingComplete",
    QUEUE: "campaign_funding_complete_queue",
    PREFETCH: 1,
};

let channel = null;
let connection = null;

/**
 * Start consuming FundingComplete events
 * Should be called on service startup
 */
async function startFundingCompleteConsumer() {
    try {
        connection = await amqp.connect(RABBITMQ_CONFIG.URL);
        channel = await connection.createChannel();

        // Declare exchange
        await channel.assertExchange(RABBITMQ_CONFIG.EXCHANGE, "topic", {
            durable: true,
        });

        // Declare queue
        const queueInfo = await channel.assertQueue(RABBITMQ_CONFIG.QUEUE, {
            durable: true,
        });

        // Bind queue to exchange
        await channel.bindQueue(
            RABBITMQ_CONFIG.QUEUE,
            RABBITMQ_CONFIG.EXCHANGE,
            RABBITMQ_CONFIG.ROUTING_KEY,
        );

        // Set prefetch to ensure only one message processed at a time
        await channel.prefetch(RABBITMQ_CONFIG.PREFETCH);

        console.log(
            `[fundingCompleteConsumer] Listening for ${RABBITMQ_CONFIG.ROUTING_KEY} ` +
                `on queue ${RABBITMQ_CONFIG.QUEUE}...`,
        );

        // Start consuming
        await channel.consume(RABBITMQ_CONFIG.QUEUE, async (msg) => {
            if (msg !== null) {
                try {
                    await handleFundingCompleteEvent(msg);
                    // Acknowledge message
                    channel.ack(msg);
                } catch (error) {
                    console.error(
                        `[fundingCompleteConsumer] Failed to process message: ${error.message}. ` +
                            `Nacking...`,
                    );
                    // Nack without requeue (move to dead letter queue)
                    channel.nack(msg, false, false);
                }
            }
        });
    } catch (error) {
        console.error(
            `[fundingCompleteConsumer.startFundingCompleteConsumer] ` +
                `Failed to start consumer: ${error.message}`,
        );
        // Do not crash the whole campaign-service if RabbitMQ is temporarily unavailable.
        return;
    }
}

/**
 * Handle FundingComplete event
 * @param {Object} msg - RabbitMQ message object
 */
async function handleFundingCompleteEvent(msg) {
    const content = msg.content.toString();

    let event;
    try {
        event = JSON.parse(content);
    } catch (error) {
        throw new Error(`Invalid JSON in message: ${error.message}`);
    }

    const {
        campaignId,
        campaignOnChainId,
        totalRaisedWei,
        goalReachedAt,
        transactionHash,
        fundingCompleteEventId,
    } = event;

    console.log(
        `[fundingCompleteConsumer.handleFundingCompleteEvent] ` +
            `Received: campaignId=${campaignId}, onChainId=${campaignOnChainId}, ` +
            `raised=${totalRaisedWei}, txHash=${transactionHash}`,
    );

    try {
        // 1. Fetch campaign
        let campaign;
        if (campaignId) {
            campaign = await Campaign.findById(campaignId);
        } else if (campaignOnChainId) {
            campaign = await Campaign.findOne({ onChainId: campaignOnChainId });
        }

        if (!campaign) {
            throw new Error(
                `Campaign not found: campaignId=${campaignId}, ` +
                    `campaignOnChainId=${campaignOnChainId}`,
            );
        }

        // 2. Fetch milestones
        const milestones = await Milestone.find({
            campaignId: campaign._id,
        }).sort({ milestoneIndex: 1 });

        if (!milestones.length) {
            throw new Error(`No milestones found for campaign ${campaign._id}`);
        }

        // 3. Fetch donor contributions from campaign donations
        // Assuming we have donation data stored or referenced in the campaign
        const donationSnapshots = await getDonationSnapshots(campaign.onChainId);

        if (!donationSnapshots.length) {
            console.warn(
                `[fundingCompleteConsumer] No donation snapshots found for ` +
                    `campaign ${campaign._id}. Skipping allocation computation.`,
            );
            return;
        }

        // 4. Compute allocation
        console.log(
            `[fundingCompleteConsumer] Computing allocation for ` +
                `${donationSnapshots.length} donors across ${milestones.length} milestones...`,
        );

        const { campaignDonorShares, summary } =
            await allocationService.computeAllocationAndSeedRefunds(
                campaign,
                milestones,
                donationSnapshots,
            );

        // 5. Persist to database
        const { insertedShareCount, insertedRefundCount } =
            await allocationService.persistAllocations(campaignDonorShares);

        // 6. Update campaign status
        campaign.lifecycleStatus = "funding_complete";
        campaign.fundingCompletedAt = new Date(goalReachedAt * 1000); // Convert Unix timestamp
        await campaign.save();

        console.log(
            `[fundingCompleteConsumer] SUCCESS: ` +
                `Campaign ${campaign._id} allocation computed. ` +
                `Inserted ${insertedShareCount} shares, ${insertedRefundCount} refunds. ` +
                `Summary: ${JSON.stringify(summary)}`,
        );
    } catch (error) {
        console.error(
            `[fundingCompleteConsumer.handleFundingCompleteEvent] ` +
                `Error processing FundingComplete event: ${error.message}. ` +
                `Event: ${JSON.stringify(event)}`,
        );
        throw error;
    }
}

/**
 * Fetch donation snapshots for a campaign
 * This is a placeholder - actual implementation depends on how donations are tracked
 *
 * @param {ObjectId} campaignId - Campaign ID
 * @returns {Promise<Array>} Array of {walletAddress, totalWei}
 */
async function getDonationSnapshots(campaignId) {
    const donationServiceBase =
        process.env.DONATION_SERVICE_URL || "http://donation-service:4003";
    const endpoint = `${donationServiceBase}/api/donations/campaign/${campaignId}`;

    try {
        const response = await fetch(endpoint, {
            method: "GET",
            headers: { "Content-Type": "application/json" },
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status} from donation-service`);
        }

        const body = await response.json();
        const rows = Array.isArray(body?.data) ? body.data : [];

        const grouped = new Map();
        for (const row of rows) {
            const donor = String(row?.donorWallet || row?.donorAddress || "").toLowerCase();
            const amount = BigInt(row?.amount || row?.totalWei || "0");
            if (!/^0x[a-f0-9]{40}$/.test(donor) || amount <= 0n) continue;
            grouped.set(donor, (grouped.get(donor) || 0n) + amount);
        }

        const snapshots = Array.from(grouped.entries()).map(([walletAddress, totalWei]) => ({
            walletAddress,
            totalWei: totalWei.toString(),
        }));

        console.log(
            `[getDonationSnapshots] campaign=${campaignId}, rows=${rows.length}, donors=${snapshots.length}`,
        );
        return snapshots;
    } catch (error) {
        console.error(
            `[getDonationSnapshots] Failed to fetch donations for campaign=${campaignId}: ${error.message}`,
        );
        return [];
    }
}

/**
 * Graceful shutdown
 */
async function stopFundingCompleteConsumer() {
    try {
        if (channel) {
            await channel.close();
        }
        if (connection) {
            await connection.close();
        }
        console.log("[fundingCompleteConsumer] Consumer stopped");
    } catch (error) {
        console.error(
            `[fundingCompleteConsumer.stopFundingCompleteConsumer] ` +
                `Error closing connection: ${error.message}`,
        );
    }
}

module.exports = {
    startFundingCompleteConsumer,
    handleFundingCompleteEvent,
    stopFundingCompleteConsumer,
};
