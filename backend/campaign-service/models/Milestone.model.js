const mongoose = require("mongoose");

const MilestoneSchema = new mongoose.Schema(
    {
        campaignId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Campaign",
            required: [true, "campaignId là bắt buộc"],
        },
        // On-chain campaign ID for quick reference
        campaignOnChainId: {
            type: Number,
            required: [true, "campaignOnChainId là bắt buộc"],
        },
        // Position in milestone sequence (1, 2, 3...)
        milestoneIndex: {
            type: Number,
            required: [true, "milestoneIndex là bắt buộc"],
        },
        title: {
            type: String,
            required: [true, "Tiêu đề milestone là bắt buộc"],
            trim: true,
            maxlength: [200, "Tiêu đề tối đa 200 ký tự"],
        },
        description: {
            type: String,
            default: "",
        },
        // Lưu dạng String để tránh mất precision khi xử lý BigInt wei
        financialTargetWei: {
            type: String,
            required: [true, "Mục tiêu tài chính là bắt buộc"],
            default: "0",
        },
        deadline: {
            type: Date,
            required: [true, "Deadline là bắt buộc"],
        },
        // Lifecycle status: pending_funding → pending_verification → approved → disbursed
        // OR: failed → refunded
        status: {
            type: String,
            enum: [
                "pending_funding",
                "pending_verification",
                "submitted",
                "resubmittable",
                "deadline_exceeded",
                "review_timeout",
                "approved",
                "disbursed",
                "failed",
                "refunded",
            ],
            default: "pending_funding",
        },
        // Array of IPFS CIDs for evidence
        evidenceCids: {
            type: [String],
            default: [],
        },
        // Audit timestamps
        approvedAt: {
            type: Date,
            default: null,
        },
        disbursedAt: {
            type: Date,
            default: null,
        },
        refundedAt: {
            type: Date,
            default: null,
        },
        rejectionCount: {
            type: Number,
            default: 0,
        },
        maxRetries: {
            type: Number,
            default: 3,
        },
        lastRejectionReason: {
            type: String,
            default: null,
        },
        lastRejectionTimestamp: {
            type: Date,
            default: null,
        },
        rejectionHistory: {
            type: [
                {
                    timestamp: Date,
                    reason: String,
                    reviewerWallet: String,
                    resubmittedAt: Date,
                    resubmittedEvidenceCid: String,
                },
            ],
            default: [],
        },
        submittedAt: {
            type: Date,
            default: null,
        },
        deadlineExceededAt: {
            type: Date,
            default: null,
        },
        reviewTimeoutAt: {
            type: Date,
            default: null,
        },
        failureReason: {
            type: String,
            default: null,
        },
    },
    { timestamps: true },
);

// Unique constraint: (campaignId, milestoneIndex)
MilestoneSchema.index({ campaignId: 1, milestoneIndex: 1 }, { unique: true });
// Unique constraint: (campaignOnChainId, milestoneIndex)
MilestoneSchema.index(
    { campaignOnChainId: 1, milestoneIndex: 1 },
    { unique: true },
);
// Query by status + deadline
MilestoneSchema.index({ status: 1, deadline: 1 });

module.exports =
    mongoose.models.Milestone || mongoose.model("Milestone", MilestoneSchema);
