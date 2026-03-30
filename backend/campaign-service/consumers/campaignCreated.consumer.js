const { getChannel, EXCHANGE } = require("../config/rabbitmq");
const campaignService = require("../services/campaign.service");
const { Milestone, Campaign } = require("../models");

const QUEUE =
    process.env.RABBITMQ_QUEUE_CAMP_CREATED || "campaign.created.queue";
const ROUTING_KEY =
    process.env.RABBITMQ_RKEY_CAMP_CREATED || "campaign.created";

function mapMilestoneStatusFromCode(statusCode) {
    const statusMap = {
        0: "pending_funding",
        1: "pending_verification",
        2: "approved",
        3: "disbursed",
        4: "failed",
        5: "refunded",
    };
    return statusMap[Number(statusCode)] || "pending_funding";
}

/**
 * Đăng ký consumer lắng nghe queue campaign.created.queue.
 * Khi listener-service bắt được event CampaignCreated từ blockchain,
 * nó publish lên RabbitMQ → consumer này nhận và lưu vào MongoDB.
 */
async function startCampaignCreatedConsumer() {
    const channel = getChannel();
    if (!channel) {
        console.warn(
            "[campaign-service] RabbitMQ channel không có – bỏ qua consumer",
        );
        return;
    }

    // Khai báo queue và bind vào exchange
    await channel.assertQueue(QUEUE, { durable: true });
    await channel.bindQueue(QUEUE, EXCHANGE, ROUTING_KEY);

    // Chỉ nhận 1 message tại 1 thời điểm (prefetch)
    channel.prefetch(1);

    console.log(`[campaign-service] Consumer đang lắng nghe queue: ${QUEUE}`);

    channel.consume(QUEUE, async (msg) => {
        if (!msg) return;

        try {
            const payload = JSON.parse(msg.content.toString());
            console.log(
                "[campaign-service] Nhận event campaign.created:",
                payload,
            );

            /**
             * Payload từ listener-service:
             * { onChainId, creator, beneficiary, goal, deadline, txHash }
             */
            await campaignService.upsertCampaign({
                onChainId: payload.onChainId,
                creator: payload.creator,
                beneficiary: payload.beneficiary,
                goal: payload.goal, // wei dạng string
                deadline: new Date(payload.deadline * 1000), // unix timestamp → Date
                status: "active",
            });

            if (
                Array.isArray(payload.milestones) &&
                payload.milestones.length
            ) {
                const campaign = await Campaign.findOne({
                    onChainId: Number(payload.onChainId),
                });

                if (!campaign) {
                    throw new Error(
                        `Campaign not found after upsert: onChainId=${payload.onChainId}`,
                    );
                }

                const ops = payload.milestones.map((m, idx) => {
                    const milestoneIndex = Number(m.milestoneIndex || idx + 1);
                    return {
                        updateOne: {
                            filter: {
                                campaignOnChainId: Number(payload.onChainId),
                                milestoneIndex,
                            },
                            update: {
                                $set: {
                                    campaignId: campaign._id,
                                    campaignOnChainId: Number(
                                        payload.onChainId,
                                    ),
                                    milestoneIndex,
                                    title:
                                        m.title ||
                                        `Milestone ${milestoneIndex}`,
                                    description: m.description || "",
                                    financialTargetWei: (
                                        m.financialTargetWei || "0"
                                    ).toString(),
                                    deadline: new Date(
                                        Number(m.deadline || payload.deadline) *
                                            1000,
                                    ),
                                    status: mapMilestoneStatusFromCode(
                                        m.statusCode,
                                    ),
                                    evidenceCids: m.proofIpfsCid
                                        ? [m.proofIpfsCid]
                                        : [],
                                },
                            },
                            upsert: true,
                        },
                    };
                });

                await Milestone.bulkWrite(ops, { ordered: false });

                const syncedMilestones = await Milestone.find({
                    campaignOnChainId: Number(payload.onChainId),
                })
                    .sort({ milestoneIndex: 1 })
                    .select("_id");

                await Campaign.findByIdAndUpdate(campaign._id, {
                    $set: { milestoneIds: syncedMilestones.map((x) => x._id) },
                });

                console.log(
                    `[campaign-service] Synced milestones: campaignOnChainId=${payload.onChainId}, count=${syncedMilestones.length}`,
                );
            } else {
                console.warn(
                    `[campaign-service] campaign.created payload không có milestones. campaignOnChainId=${payload.onChainId}`,
                );
            }

            console.log(
                `[campaign-service] Đã lưu campaign onChainId=${payload.onChainId}`,
            );
            channel.ack(msg);
        } catch (err) {
            console.error("[campaign-service] Consumer error:", err.message);
            // nack + requeue = false → đưa vào dead-letter nếu có, không requeue vô hạn
            channel.nack(msg, false, false);
        }
    });
}

module.exports = { startCampaignCreatedConsumer };
