const { getChannel, EXCHANGE } = require("../config/rabbitmq");
const { Milestone } = require("../models");
const { recordTransaction } = require("../utils/recordTransaction");

const QUEUE =
    process.env.RABBITMQ_QUEUE_MILESTONE_REPORT_SUBMITTED ||
    "milestone.report.submitted.queue";
const ROUTING_KEY =
    process.env.RABBITMQ_RKEY_MILESTONE_REPORT_SUBMITTED ||
    "milestone.report.submitted";

async function startMilestoneReportSubmittedConsumer() {
    const channel = getChannel();
    if (!channel) {
        console.warn(
            "[campaign-service] RabbitMQ channel unavailable. Skip milestone.report.submitted consumer",
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

            if (!campaignOnChainId || Number.isNaN(milestoneId)) {
                throw new Error("Missing campaignId/milestoneId in milestone.report.submitted payload");
            }

            const cid = (payload.cid || payload.ipfsCid || "").toString();
            const submittedAt = new Date();

            const update = {
                $set: {
                    status: "pending_verification",
                },
            };

            if (cid) {
                update.$push = { reportCids: { cid, submittedAt } };
                update.$addToSet = { evidenceCids: cid };
            }

            await Milestone.updateOne(
                { campaignOnChainId, milestoneId },
                update,
            );

            await recordTransaction({
                txHash: payload.txHash,
                walletAddress: payload.submittedBy,
                action: "submitReport",
                campaignOnChainId,
            });

            channel.ack(msg);
        } catch (error) {
            console.error(
                "[campaign-service] milestoneReportSubmitted consumer error:",
                error.message,
            );
            channel.nack(msg, false, false);
        }
    });
}

module.exports = { startMilestoneReportSubmittedConsumer };
