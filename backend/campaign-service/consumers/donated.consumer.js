const { getChannel, EXCHANGE } = require("../config/rabbitmq");
const campaignService = require("../services/campaign.service");

const QUEUE = process.env.RABBITMQ_QUEUE_CAMP_DONATED || "campaign.donation.queue";
const ROUTING_KEY = process.env.RABBITMQ_RKEY_DONATED || "donation.received";

async function startDonatedConsumer() {
    const channel = getChannel();
    if (!channel) {
        console.warn("[campaign-service] RabbitMQ channel không có – bỏ qua donation consumer");
        return;
    }

    const DONATION_EXCHANGE = process.env.RABBITMQ_EXCHANGE || "funding.events";

    await channel.assertQueue(QUEUE, { durable: true });
    await channel.bindQueue(QUEUE, DONATION_EXCHANGE, ROUTING_KEY);
    channel.prefetch(1);

    console.log(`[campaign-service] Consumer đang lắng nghe queue: ${QUEUE}`);

    channel.consume(QUEUE, async (msg) => {
        if (!msg) return;

        try {
            const payload = JSON.parse(msg.content.toString());
            console.log("[campaign-service] Nhận event donation.received:", payload);

            // payload: { campaignId, donor, amount, txHash }
            // Tìm campaign xem nó raised bao nhiêu 
            const campaign = await campaignService.getCampaignById(payload.campaignId);
            if (campaign) {
                // Đổi string sang bigInt rồi cộng dồn
                const currentRaised = BigInt(campaign.raised || "0");
                const donationAmount = BigInt(payload.amount);
                const newRaised = (currentRaised + donationAmount).toString();

                await campaignService.updateRaised(payload.campaignId, newRaised);

                // Nếu đạt goal thì update status
                const goalAmount = BigInt(campaign.goal || "0");
                if (currentRaised + donationAmount >= goalAmount) {
                     await campaignService.updateCampaignStatus(payload.campaignId, "ended");
                     console.log(`[campaign-service] Campaign ${payload.campaignId} đã đạt mục tiêu!`);
                }
                
                console.log(`[campaign-service] Đã update raised cho campaign: ${payload.campaignId}`);
            }

            channel.ack(msg);
        } catch (err) {
            console.error("[campaign-service] Donated Consumer error:", err.message);
            channel.nack(msg, false, false);
        }
    });
}

module.exports = { startDonatedConsumer };
