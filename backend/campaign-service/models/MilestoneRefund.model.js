const mongoose = require("mongoose");

// MilestoneRefund: theo dõi eligibility và trạng thái hoàn tiền theo donor cho từng milestone
const MilestoneRefundSchema = new mongoose.Schema(
    {
        campaignId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Campaign",
            required: [true, "campaignId là bắt buộc"],
        },
        campaignOnChainId: {
            type: Number,
            required: [true, "campaignOnChainId là bắt buộc"],
        },
        milestoneId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Milestone",
            required: [true, "milestoneId là bắt buộc"],
        },
        milestoneIndex: {
            type: Number,
            required: [true, "milestoneIndex là bắt buộc"],
        },
        donorAddress: {
            type: String,
            required: [true, "donorAddress là bắt buộc"],
            lowercase: true,
            trim: true,
            match: [/^0x[a-fA-F0-9]{40}$/, "Địa chỉ ví donor không hợp lệ"],
        },
        eligibleRefundWei: {
            type: String,
            required: [true, "eligibleRefundWei là bắt buộc"],
            default: "0",
        },
        refundedWei: {
            type: String,
            default: "0",
        },
        status: {
            type: String,
            enum: ["eligible", "prepared", "refunded", "rejected"],
            default: "eligible",
        },
        preparedAt: {
            type: Date,
            default: null,
        },
        refundedAt: {
            type: Date,
            default: null,
        },
        refundTxHash: {
            type: String,
            default: null,
        },
        // Idempotency key format: `${txHash}-${logIndex}`
        refundEventId: {
            type: String,
            default: null,
        },
    },
    { timestamps: true },
);

// Mỗi donor có tối đa 1 refund-state record cho 1 milestone
MilestoneRefundSchema.index(
    { campaignId: 1, milestoneId: 1, donorAddress: 1 },
    { unique: true },
);

// Idempotency cho listener event duplicate
MilestoneRefundSchema.index(
    { refundEventId: 1 },
    { unique: true, sparse: true },
);

// Query lịch sử refund theo donor
MilestoneRefundSchema.index({ donorAddress: 1, updatedAt: -1 });

module.exports =
    mongoose.models.MilestoneRefund ||
    mongoose.model("MilestoneRefund", MilestoneRefundSchema);
