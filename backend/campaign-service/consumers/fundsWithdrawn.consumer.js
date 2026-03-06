const { getChannel, EXCHANGE } = require("../config/rabbitmq");
const campaignService = require("../services/campaign.service");

const QUEUE = "funds.withdrawn.queue";
const ROUTING_KEY = "funds.withdrawn";

/**
 * Lắng nghe event FundsWithdrawn từ listener-service.
 * Khi campaign rút quỹ thành công → cập nhật status = "ended".
 */
async function startFundsWithdrawnConsumer() {
    const channel = getChannel();
    if (!channel) {
        console.warn("[campaign-service] RabbitMQ channel không có – bỏ qua funds.withdrawn consumer");
        return;
    }

    await channel.assertQueue(QUEUE, { durable: true });
    await channel.bindQueue(QUEUE, EXCHANGE, ROUTING_KEY);
    channel.prefetch(1);

    console.log(`[campaign-service] Consumer đang lắng nghe queue: ${QUEUE}`);

    channel.consume(QUEUE, async (msg) => {
        if (!msg) return;
        try {
            const payload = JSON.parse(msg.content.toString());
            console.log("[campaign-service] Nhận event funds.withdrawn:", payload);

            // Cập nhật trạng thái camp thành ended sau khi rút quỹ
            await campaignService.updateCampaignStatus(payload.campaignOnChainId, "ended");
            console.log(`[campaign-service] Campaign ${payload.campaignOnChainId} → ended (funds withdrawn)`);

            channel.ack(msg);
        } catch (err) {
            console.error("[campaign-service] fundsWithdrawn consumer error:", err.message);
            channel.nack(msg, false, false);
        }
    });
}

module.exports = { startFundsWithdrawnConsumer };
