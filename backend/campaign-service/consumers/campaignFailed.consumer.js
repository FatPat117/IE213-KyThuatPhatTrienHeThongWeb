const { getChannel, EXCHANGE } = require("../config/rabbitmq");
const campaignService = require("../services/campaign.service");
const { Campaign, Donation } = require("../models");
const notificationService = require("../services/notification.service");
const { recordTransaction } = require("../utils/recordTransaction");

const QUEUE = process.env.RABBITMQ_QUEUE_CAMP_FAILED || "campaign.failed.queue";
const ROUTING_KEY = process.env.RABBITMQ_RKEY_CAMP_FAILED || "campaign.failed";

async function startCampaignFailedConsumer() {
    const channel = getChannel();
    if (!channel) {
        console.warn(
            "[campaign-service] RabbitMQ channel unavailable. Skip campaign.failed consumer.",
        );
        return;
    }

    await channel.assertQueue(QUEUE, { durable: true });
    await channel.bindQueue(QUEUE, EXCHANGE, ROUTING_KEY);
    channel.prefetch(1);

    console.log(
        `[campaign-service] Listening for ${ROUTING_KEY} on queue: ${QUEUE}`,
    );

    channel.consume(QUEUE, async (msg) => {
        if (!msg) return;
        try {
            const payload = JSON.parse(msg.content.toString());
            const campaignOnChainId = Number(
                payload.campaignOnChainId ?? payload.campaignId,
            );

            if (!Number.isFinite(campaignOnChainId)) {
                throw new Error(
                    "Missing campaignId in campaign.failed payload",
                );
            }

            // Call handleCampaignCascadeFailure to update status and create refund records
            const { handleCampaignCascadeFailure } = require("../services/refundService");
            const campaign = await handleCampaignCascadeFailure(campaignOnChainId);
            
            console.log(
                `[campaign-service] Campaign ${campaignOnChainId} -> failed (via cascade)`,
            );

            await recordTransaction({
                txHash: payload.txHash,
                walletAddress: campaign?.creator,
                action: "campaignFail",
                campaignOnChainId,
                campaignTitle: campaign?.title,
            });

            if (campaign?.creator) {
                const isFundingFailure = payload.reason === "funding_deadline_not_reached_goal" || payload.reason === "AUTO_EXPIRATION_SYNC";
                const failureTitle = isFundingFailure ? "Chiến dịch thất bại (Không đủ vốn)" : "Chiến dịch thất bại (Mốc hỏng)";
                const failureMessage = isFundingFailure 
                    ? `Chiến dịch "${campaign.title || `#${campaignOnChainId}`}" đã kết thúc nhưng không đạt được mục tiêu gây quỹ (Goal). Hệ thống đã tự động chuyển sang trạng thái thất bại và chuẩn bị hoàn tiền cho nhà hảo tâm.`
                    : `Chiến dịch "${campaign.title || `#${campaignOnChainId}`}" đã thất bại tại một cột mốc. Nhà hảo tâm có thể yêu cầu hoàn lại phần tiền chưa sử dụng.`;

                await notificationService.createNotification({
                    recipientWallet: campaign.creator,
                    type: "campaign_failed",
                    title: failureTitle,
                    message: failureMessage,
                    campaignOnChainId: Number(campaignOnChainId),
                    txHash: payload.txHash || "",
                });
            }

            // --- Notify Donors ---
            try {
                const uniqueDonors = await Donation.distinct("donorWallet", {
                    campaignOnChainId: Number(campaignOnChainId),
                });

                if (uniqueDonors.length > 0) {
                    const donorTitle = "Chiến dịch bạn quyên góp đã thất bại";
                    const donorMessage = `Chiến dịch "${campaign?.title || `#${campaignOnChainId}`}" đã thất bại. Bạn có thể thực hiện yêu cầu hoàn lại tiền tại trang chi tiết chiến dịch.`;
                    
                    await Promise.all(
                        uniqueDonors.map((donorWallet) =>
                            notificationService.createNotification({
                                recipientWallet: donorWallet,
                                type: "campaign_failed",
                                title: donorTitle,
                                message: donorMessage,
                                campaignOnChainId: Number(campaignOnChainId),
                                txHash: payload.txHash || "",
                            }),
                        ),
                    );
                }
            } catch (notifyErr) {
                console.error(`[campaign-service] Failed to notify donors for campaign ${campaignOnChainId}:`, notifyErr.message);
            }

            channel.ack(msg);
        } catch (err) {
            console.error(
                "[campaign-service] campaignFailed consumer error:",
                err.message,
            );
            channel.nack(msg, false, false);
        }
    });
}

module.exports = { startCampaignFailedConsumer };
