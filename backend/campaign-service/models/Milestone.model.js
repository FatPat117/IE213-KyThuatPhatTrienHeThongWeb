const mongoose = require("mongoose");

const MilestoneSchema = new mongoose.Schema(
    {
        campaignId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Campaign",
            required: false,
        },
        campaignOnChainId: {
            type: Number,
            required: [true, "campaignOnChainId is required"],
        },
        milestoneId: {
            type: Number,
            required: [true, "milestoneId is required"],
        },
        milestoneIndex: {
            type: Number,
            default: null,
        },
        allocationBps: {
            type: Number,
            required: [true, "allocationBps is required"],
            min: [0, "allocationBps must be >= 0"],
            max: [10000, "allocationBps must be <= 10000"],
        },
        financialTargetWei: {
            type: String,
            default: "0",
        },
        title: {
            type: String,
            default: "",
            trim: true,
            maxlength: [200, "Title max length is 200 chars"],
        },
        description: {
            type: String,
            default: "",
        },
        deadline: {
            type: Date,
            required: [true, "Deadline is required"],
        },
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
        reportCids: {
            type: [
                {
                    cid: {
                        type: String,
                        required: true,
                    },
                    submittedAt: {
                        type: Date,
                        default: Date.now,
                    },
                },
            ],
            default: [],
        },
        evidenceCids: {
            type: [String],
            default: [],
        },
        approvedAt: {
            type: Date,
            default: null,
        },
        approvedBy: {
            type: String,
            default: "",
        },
        disbursedAt: {
            type: Date,
            default: null,
        },
        failedAt: {
            type: Date,
            default: null,
        },
    },
    { timestamps: true },
);

MilestoneSchema.index({ campaignId: 1, milestoneId: 1 }, { unique: true, sparse: true });
MilestoneSchema.index({ campaignOnChainId: 1, milestoneId: 1 }, { unique: true });
MilestoneSchema.index({ campaignOnChainId: 1, milestoneIndex: 1 }, { sparse: true });
MilestoneSchema.index({ status: 1, deadline: 1 });

module.exports =
    mongoose.models.Milestone || mongoose.model("Milestone", MilestoneSchema);
