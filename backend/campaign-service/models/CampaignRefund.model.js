const mongoose = require("mongoose");

/**
 * CampaignRefund Model
 *
 * Tracks refund eligibility and status for campaign-level failures.
 * When 1 milestone fails → entire campaign fails → all donors eligible for pro-rata refund.
 *
 * Schema:
 * - campaignId: MongoDB ObjectId reference
 * - campaignOnChainId: Ethereum chain ID (matches smart contract)
 * - donorAddress: EVM wallet address of donor
 * - eligibleRefundWei: Amount donor can claim (pro-rata calculation)
 * - refundedWei: Amount already claimed
 * - status: eligible → prepared → refunded
 * - milestone-level tracking: N/A (campaign-wide)
 */
const CampaignRefundSchema = new mongoose.Schema(
    {
        campaignId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Campaign",
            required: [true, "campaignId is required"],
            index: true,
        },
        campaignOnChainId: {
            type: Number,
            required: [true, "campaignOnChainId is required"],
            index: true,
        },
        milestoneId: {
            type: Number,
            default: null,
            index: true,
        },
        donorAddress: {
            type: String,
            required: [true, "donorAddress is required"],
            lowercase: true,
            trim: true,
            match: [/^0x[a-fA-F0-9]{40}$/, "Invalid donor wallet address"],
            index: true,
        },
        // Refund amount calculated by: (donor_contribution / total_raised) * refund_pool
        eligibleRefundWei: {
            type: String,
            required: [true, "eligibleRefundWei is required"],
            default: "0",
        },
        // Amount already refunded to donor
        refundedWei: {
            type: String,
            default: "0",
        },
        amountWei: {
            type: String,
            default: "0",
        },
        // Campaign-level refund status
        status: {
            type: String,
            enum: ["eligible", "prepared", "refunded", "rejected"],
            default: "eligible",
            index: true,
        },
        // Timestamps for state transitions
        preparedAt: {
            type: Date,
            default: null,
        },
        refundedAt: {
            type: Date,
            default: null,
        },
        claimedAt: {
            type: Date,
            default: null,
        },
        // Transaction hash from blockchain refund event
        refundTxHash: {
            type: String,
            default: null,
        },
        // Idempotency key: format = `${txHash}-${logIndex}`
        // Prevents duplicate processing of same blockchain event
        refundEventId: {
            type: String,
            index: { unique: true, sparse: true },
        },
        // Audit trail for refund preparation request
        prepareRequestId: {
            type: String,
            default: null,
        },
        // Reason for rejection if status === 'rejected'
        reasonIfRejected: {
            type: String,
            default: null,
        },
    },
    { timestamps: true },
);

// Unique constraint: 1 campaign refund record per donor per milestone failure
// If milestoneId is null, it's a general campaign failure.
// If milestoneId is set, it's a specific milestone failure.
CampaignRefundSchema.index(
    { campaignOnChainId: 1, milestoneId: 1, donorAddress: 1 },
    { unique: true, sparse: true },
);

// Idempotency: prevent listener duplicate event processing
CampaignRefundSchema.index(
    { refundEventId: 1 },
    { unique: true, sparse: true },
);

// Query refund history by donor (most recent first)
CampaignRefundSchema.index({ donorAddress: 1, updatedAt: -1 });

module.exports =
    mongoose.models.CampaignRefund ||
    mongoose.model("CampaignRefund", CampaignRefundSchema);
