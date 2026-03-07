const { getChannel, EXCHANGE } = require("../config/rabbitmq");
const campaignService = require("../services/campaign.service");

const QUEUE = "campaign.created.queue";
const ROUTING_KEY = "campaign.created";

/**
 * Đăng ký consumer lắng nghe queue campaign.created.queue.
 * Khi listener-service bắt được event CampaignCreated từ blockchain,
 * nó publish lên RabbitMQ → consumer này nhận và lưu vào MongoDB.
 */
async function startCampaignCreatedConsumer() {
    const channel = getChannel();
    if (!channel) {
        console.warn("[campaign-service] RabbitMQ channel không có – bỏ qua consumer");
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
            console.log("[campaign-service] Nhận event campaign.created:", payload);

            /**
             * Payload từ listener-service:
             * { onChainId, title, description, creator, goal, deadline, txHash }
             */
            await campaignService.upsertCampaign({
                onChainId: payload.onChainId,
                title: payload.title,
                description: payload.description || "",
                creator: payload.creator,
                goal: payload.goal,           // wei dạng string
                deadline: new Date(payload.deadline * 1000), // unix timestamp → Date
                status: "active",
            });

            console.log(`[campaign-service] Đã lưu campaign onChainId=${payload.onChainId}`);
            channel.ack(msg);
        } catch (err) {
            console.error("[campaign-service] Consumer error:", err.message);
            // nack + requeue = false → đưa vào dead-letter nếu có, không requeue vô hạn
            channel.nack(msg, false, false);
        }
    });
}

module.exports = { startCampaignCreatedConsumer };
