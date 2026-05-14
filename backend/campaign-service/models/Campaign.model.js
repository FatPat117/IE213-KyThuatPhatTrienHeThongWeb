const mongoose = require("mongoose");

const CampaignSchema = new mongoose.Schema(
    {
        onChainId: {
            type: Number,
            required: [true, "onChainId is required"],
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
        thumbnailUrl: {
            type: String,
            default: "",
        },
        creator: {
            type: String,
            required: [true, "Creator wallet is required"],
            lowercase: true,
            trim: true,
            match: [/^0x[a-fA-F0-9]{40}$/, "Invalid creator wallet address"],
        },
        beneficiary: {
            type: String,
            required: [true, "Beneficiary wallet is required"],
            lowercase: true,
            trim: true,
            match: [
                /^0x[a-fA-F0-9]{40}$/,
                "Invalid beneficiary wallet address",
            ],
        },
        goalWei: {
            type: String,
            required: [true, "goalWei is required"],
            default: "0",
        },
        goal: {
            type: String,
            default: "0",
        },
        totalRaisedWei: {
            type: String,
            default: "0",
        },
        raised: {
            type: String,
            default: "0",
        },
        totalDisbursedWei: {
            type: String,
            default: "0",
        },
        remainingWei: {
            type: String,
            default: "0",
        },
        fundingCompletedAt: {
            type: Date,
            default: null,
        },
        deadline: {
            type: Date,
            required: [true, "Deadline is required"],
        },
        milestoneCount: {
            type: Number,
            default: 0,
        },
        currentMilestoneId: {
            type: Number,
            default: 0,
        },
        reviewerSafe: {
            type: String,
            default: "",
            lowercase: true,
            trim: true,
        },
        status: {
            type: String,
            enum: [
                "pending_approval",
                "active",
                "in_progress",
                "completed",
                "partial_failed",
                "failed",
                "cancelled",
            ],
            default: "pending_approval",
        },
        milestoneIds: {
            type: [mongoose.Schema.Types.ObjectId],
            ref: "Milestone",
            default: [],
        },
        rejectionReason: {
            type: String,
            default: null,
        },
        rejectedAt: {
            type: Date,
            default: null,
        },
    },
    { timestamps: true },
);

CampaignSchema.index({ onChainId: 1 }, { unique: true });
CampaignSchema.index({ creator: 1 });
CampaignSchema.index({ beneficiary: 1 });
CampaignSchema.index({ status: 1 });
CampaignSchema.index({ deadline: 1 });
CampaignSchema.index({ createdAt: -1 });

module.exports =
    mongoose.models.Campaign || mongoose.model("Campaign", CampaignSchema);
