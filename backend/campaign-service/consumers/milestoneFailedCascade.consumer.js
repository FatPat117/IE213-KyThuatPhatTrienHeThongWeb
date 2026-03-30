const amqp = require("amqplib");
const refundService = require("../services/refundService");
const campaignService = require("../services/campaign.service");
const notificationService = require("../services/notification.service");

/**
 * MilestoneFailed Event Consumer
 * Listens for MilestoneFailed events and triggers cascade failure:
 * 1 milestone fails → campaign fails → all donors eligible for pro-rata refund
 *
 * Flow:
 * 1. Receive MilestoneFailed event from blockchain
 * 2. Call refundService.handleCampaignCascadeFailure()
 * 3. Create refund records for all donors (pro-rata)
 * 4. Update campaign.status = 'failed'
 * 5. Notify campaign creator
 */

const RABBITMQ_CONFIG = {
    URL: process.env.RABBITMQ_URL || "amqp://localhost",
    EXCHANGE: process.env.RABBITMQ_EXCHANGE || "funding.events",
    ROUTING_KEY: "blockchain.milestone.failed",
    QUEUE: "campaign_milestone_failed_queue",
    PREFETCH: 1,
};

let channel = null;
let connection = null;

/**
 * Start consuming MilestoneFailed events
 * Should be called on service startup
 */
async function startMilestoneFailedConsumer() {
    try {
        connection = await amqp.connect(RABBITMQ_CONFIG.URL);
        channel = await connection.createChannel();

        // Declare exchange
        await channel.assertExchange(RABBITMQ_CONFIG.EXCHANGE, "topic", {
            durable: true,
        });

        // Declare queue
        await channel.assertQueue(RABBITMQ_CONFIG.QUEUE, {
            durable: true,
        });

        // Bind queue to exchange
        await channel.bindQueue(
            RABBITMQ_CONFIG.QUEUE,
            RABBITMQ_CONFIG.EXCHANGE,
            RABBITMQ_CONFIG.ROUTING_KEY,
        );

        // Set prefetch
        await channel.prefetch(RABBITMQ_CONFIG.PREFETCH);

        console.log(
            `[milestoneFailedConsumer] Listening for ${RABBITMQ_CONFIG.ROUTING_KEY} ` +
                `on queue ${RABBITMQ_CONFIG.QUEUE}...`,
        );

        // Start consuming
        await channel.consume(RABBITMQ_CONFIG.QUEUE, async (msg) => {
            if (msg !== null) {
                try {
                    await handleMilestoneFailedEvent(msg);
                    // Acknowledge message
                    channel.ack(msg);
                } catch (error) {
                    console.error(
                        `[milestoneFailedConsumer] Failed to process message: ` +
                            `${error.message}. Nacking...`,
                    );
                    // Nack without requeue (move to dead letter queue)
                    channel.nack(msg, false, false);
                }
            }
        });
    } catch (error) {
        console.error(
            `[milestoneFailedConsumer.startMilestoneFailedConsumer] ` +
                `Failed to start consumer: ${error.message}`,
        );
        throw error;
    }
}

/**
 * Handle MilestoneFailed event from blockchain
 * @param {Object} msg - RabbitMQ message object
 *
 * Event structure:
 * {
 *   campaignId: number,
 *   milestoneId: number,
 *   markedBy: string (0x...),
 *   amount: string (wei as string),
 *   txHash: string (0x...),
 *   logIndex: number,
 *   blockNumber: number
 * }
 */
async function handleMilestoneFailedEvent(msg) {
    const content = msg.content.toString();

    let event;
    try {
        event = JSON.parse(content);
    } catch (error) {
        throw new Error(`Invalid JSON in message: ${error.message}`);
    }

    const {
        campaignId,
        milestoneId,
        markedBy,
        amount,
        txHash,
        logIndex,
        blockNumber,
    } = event;

    console.log(
        `[milestoneFailedConsumer.handleMilestoneFailedEvent] ` +
            `Received: campaignId=${campaignId}, milestoneId=${milestoneId}, ` +
            `markedBy=${markedBy}, amount=${amount}, txHash=${txHash}, ` +
            `logIndex=${logIndex}, blockNumber=${blockNumber}`,
    );

    // Validation
    if (!campaignId || !milestoneId || !markedBy || !amount) {
        throw new Error(
            `Missing required fields in MilestoneFailed event: ` +
                `campaignId=${campaignId}, milestoneId=${milestoneId}, ` +
                `markedBy=${markedBy}, amount=${amount}`,
        );
    }

    try {
        // Trigger cascade failure: create refund records for all donors
        const cascadeResult =
            await refundService.handleCampaignCascadeFailure(campaignId);

        console.log(
            `[milestoneFailedConsumer] Cascade failure handled: ` +
                `campaignId=${campaignId}, refundsCreated=${cascadeResult.refundsCreated}, ` +
                `totalDonors=${cascadeResult.totalDonors}, refundPoolWei=${cascadeResult.refundPoolWei}`,
        );

        // Get campaign to notify creator
        const campaign =
            await campaignService.findByCampaignOnChainId(campaignId);
        if (campaign?.creator) {
            await notificationService.createNotification({
                recipientWallet: campaign.creator,
                type: "milestone_failed",
                title: "Một milestone của chiến dịch thất bại",
                message:
                    `Milestone #${milestoneId} của chiến dịch "${campaign.title || `#${campaignId}`}" ` +
                    `đã bị từ chối. Chiến dịch bây giờ cần hoàn tiền cho tất cả những người quyên góp.`,
                campaignOnChainId: Number(campaignId),
                txHash,
            });
        }
    } catch (error) {
        console.error(
            `[milestoneFailedConsumer.handleMilestoneFailedEvent] ` +
                `Error processing MilestoneFailed event: ${error.message}. ` +
                `Event: ${JSON.stringify(event)}`,
        );
        throw error;
    }
}

/**
 * Graceful shutdown
 */
async function stopMilestoneFailedConsumer() {
    try {
        if (channel) {
            await channel.close();
        }
        if (connection) {
            await connection.close();
        }
        console.log("[milestoneFailedConsumer] Consumer stopped");
    } catch (error) {
        console.error(
            "[milestoneFailedConsumer] Error stopping consumer:",
            error.message,
        );
    }
}

module.exports = {
    startMilestoneFailedConsumer,
    stopMilestoneFailedConsumer,
};
