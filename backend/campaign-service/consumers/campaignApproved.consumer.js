const { getChannel, EXCHANGE } = require("../config/rabbitmq");
const { Campaign } = require("../models");
const notificationService = require("../services/notification.service");

const QUEUE =
    process.env.RABBITMQ_QUEUE_CAMPAIGN_APPROVED || "campaign.approved.queue";
const ROUTING_KEY =
    process.env.RABBITMQ_RKEY_CAMPAIGN_APPROVED || "campaign.approved";

async function startCampaignApprovedConsumer() {
    const channel = getChannel();
    if (!channel) return;

    await channel.assertQueue(QUEUE, { durable: true });
    await channel.bindQueue(QUEUE, EXCHANGE, ROUTING_KEY);
    channel.prefetch(1);

    channel.consume(QUEUE, async (msg) => {
        if (!msg) return;
        try {
            const payload = JSON.parse(msg.content.toString());
            const onChainId = Number(payload.campaignId || payload.campaignOnChainId);
            if (!Number.isFinite(onChainId)) {
                throw new Error("Invalid campaignId");
            }
            const campaign = await Campaign.findOneAndUpdate(
                { onChainId },
                { $set: { status: "active" } },
                { new: true },
            );
            if (campaign?.creator) {
                await notificationService.createNotification({
                    recipientWallet: campaign.creator,
                    type: "campaign_approved",
                    title: "Chiến dịch đã được duyệt",
                    message: "Chiến dịch của bạn đã được duyệt, bắt đầu nhận quyên góp.",
                    campaignOnChainId: onChainId,
                    txHash: payload.txHash || "",
                });
            }
            // Thông báo cho reviewer của campaign này biết rằng campaign đã được duyệt
            if (campaign?.reviewerSafe && /^0x[a-f0-9]{40}$/i.test(campaign.reviewerSafe)) {
                await notificationService.createNotification({
                    recipientWallet: campaign.reviewerSafe.toLowerCase(),
                    type: "campaign_approved",
                    title: "Chiến dịch bạn quản lý đã được duyệt",
                    message: `Chiến dịch #${onChainId} mà bạn là kiểm duyệt viên đã được quản trị viên duyệt và sắp bắt đầu nhận quyên góp. Hãy chuẩn bị để theo dõi các mốc.`,
                    campaignOnChainId: onChainId,
                    txHash: payload.txHash || "",
                });
            }
            channel.ack(msg);
        } catch (error) {
            console.error("[campaign-service] campaignApproved consumer error:", error.message);
            channel.nack(msg, false, false);
        }
    });
}

module.exports = { startCampaignApprovedConsumer };
