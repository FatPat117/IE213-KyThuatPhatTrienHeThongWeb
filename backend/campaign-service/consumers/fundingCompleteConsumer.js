const { getChannel, EXCHANGE } = require("../config/rabbitmq");
const { Campaign, CampaignDonorShare, Donation, Milestone } = require("../models");
const allocationService = require("../services/allocation.service"); // Giả định service này đã tồn tại

const QUEUE =
    process.env.RABBITMQ_QUEUE_FUNDING_COMPLETE ||
    "campaign.funding.completed.queue";
const ROUTING_KEY =
    process.env.RABBITMQ_RKEY_FUNDING_COMPLETE || "campaign.funding.completed";

/**
 * Start the Funding Complete Consumer
 */
async function startFundingCompleteConsumer() {
    const channel = getChannel();

    if (!channel) {
        console.error("[campaign-service] RabbitMQ channel unavailable. Cannot start consumer.");
        return;
    }

    try {
        // Đảm bảo Queue tồn tại và bind đúng Routing Key
        await channel.assertQueue(QUEUE, { durable: true });
        await channel.bindQueue(QUEUE, EXCHANGE, ROUTING_KEY);
        await channel.prefetch(1); // Xử lý từng tin nhắn một để tránh quá tải

        console.log(`[campaign-service] Listening for ${ROUTING_KEY} on ${QUEUE}...`);

        await channel.consume(QUEUE, async (msg) => {
            if (msg !== null) {
                try {
                    const content = JSON.parse(msg.content.toString());
                    await handleFundingCompleteEvent(content);
                    channel.ack(msg);
                } catch (error) {
                    console.error(
                        `[fundingCompleteConsumer] Failed to process message: ${error.message}. Nacking...`
                    );
                    // Nack và không đẩy lại queue (tránh loop vô tận nếu code lỗi)
                    channel.nack(msg, false, false);
                }
            }
        });
    } catch (error) {
        console.error(`[fundingCompleteConsumer] Startup error: ${error.message}`);
    }
}

/**
 * Handle FundingComplete event logic
 */
async function handleFundingCompleteEvent(event) {
    const {
        campaignId,
        campaignOnChainId,
        totalRaisedWei,
        goalReachedAt,
        transactionHash
    } = event;

    console.log(`[fundingCompleteConsumer] Processing: campaignOnChainId=${campaignOnChainId}`);

    // 1. Fetch campaign (ưu tiên tìm theo onChainId để đảm bảo tính nhất quán với Blockchain)
    const campaign = await Campaign.findOne({
        $or: [{ onChainId: campaignOnChainId }, { _id: campaignId }]
    });

    if (!campaign) {
        throw new Error(`Campaign not found for ID: ${campaignOnChainId || campaignId}`);
    }

    // IDEMPOTENCY: Nếu đã xử lý rồi thì bỏ qua
    if (campaign.lifecycleStatus === "funding_complete" || campaign.lifecycleStatus === "in_progress") {
        console.log(`[fundingCompleteConsumer] Campaign ${campaign._id} already processed. Skipping.`);
        return;
    }

    // 2. Fetch milestones
    const milestones = await Milestone.find({ campaignId: campaign._id }).sort({ milestoneIndex: 1 });
    if (!milestones.length) {
        throw new Error(`No milestones found for campaign ${campaign._id}`);
    }

    // 3. Thực hiện lấy danh sách Donor và tổng tiền họ đóng (Aggregate từ bảng Donation)
    const donationSnapshots = await getDonationSnapshots(campaign._id);
    if (!donationSnapshots.length) {
        console.warn(`[fundingCompleteConsumer] No donations found for campaign ${campaign._id}.`);
        return;
    }

    // 4. Tính toán phân bổ (Allocation) và lưu vào Database
    // Logic này nằm trong allocationService để đảm bảo tính bao đóng
    const result = await allocationService.computeAndPersistAllocations({
        campaign,
        milestones,
        donationSnapshots,
        totalRaisedWei
    });

    // 5. Cập nhật trạng thái Campaign
    campaign.lifecycleStatus = "in_progress"; // Chuyển sang giai đoạn thực hiện mốc
    campaign.fundingCompletedAt = new Date(goalReachedAt * 1000);
    campaign.totalRaisedWei = totalRaisedWei;
    await campaign.save();

    console.log(`[fundingCompleteConsumer] SUCCESS: Campaign ${campaign._id} is now IN_PROGRESS.`);
}

/**
 * Lấy danh sách Donor và tổng số tiền họ đã đóng góp
 * Dùng MongoDB Aggregate để group theo walletAddress
 */
async function getDonationSnapshots(campaignId) {
    return await Donation.aggregate([
        { $match: { campaignId: campaignId, status: "confirmed" } },
        {
            $group: {
                _id: "$donorAddress",
                totalWei: { $sum: { $toDecimal: "$amountWei" } } // Chuyển sang Decimal để tránh tràn số
            }
        },
        {
            $project: {
                walletAddress: "$_id",
                totalWei: { $toString: "$totalWei" }, // Trả về string để an toàn cho BigInt
                _id: 0
            }
        }
    ]);
}

module.exports = {
    startFundingCompleteConsumer,
};
