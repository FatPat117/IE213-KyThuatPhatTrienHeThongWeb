const mongoose = require("mongoose");

const CampaignSchema = new mongoose.Schema(
    {
        // Mapping 1-1 với ID trên Smart Contract
        onChainId: {
            type: Number,
            required: [true, "onChainId là bắt buộc"],
            unique: true,
        },
        title: {
            type: String,
            default: "Untitled Campaign",
            trim: true,
            maxlength: [200, "Tiêu đề tối đa 200 ký tự"],
        },
        description: {
            type: String,
            default: "",
        },
        // Lưu off-chain vì Blockchain không chứa nổi ảnh
        images: {
            type: [String],
            default: [],
        },
        creator: {
            type: String,
            required: [true, "Creator wallet là bắt buộc"],
            lowercase: true,
            trim: true,
            match: [/^0x[a-fA-F0-9]{40}$/, "Địa chỉ ví creator không hợp lệ"],
        },
        beneficiary: {
            type: String,
            lowercase: true,
            trim: true,
            match: [
                /^0x[a-fA-F0-9]{40}$/,
                "Địa chỉ ví beneficiary không hợp lệ",
            ],
            default: null,
        },
        // Lưu dạng String để tránh mất precision khi xử lý BigInt wei
        goal: {
            type: String,
            required: [true, "Goal là bắt buộc"],
            default: "0",
        },
        raised: {
            type: String,
            default: "0",
        },
        deadline: {
            type: Date,
            required: [true, "Deadline là bắt buộc"],
        },
        status: {
            type: String,
            enum: ["active", "ended", "failed", "cancelled"],
            default: "active",
        },
        // Phase 3: Milestone System
        milestoneIds: {
            type: [mongoose.Schema.Types.ObjectId],
            ref: "Milestone",
            default: [],
        },
        reviewCommitteeWallet: {
            type: String,
            lowercase: true,
            trim: true,
            match: [/^0x[a-fA-F0-9]{40}$/, "Địa chỉ ví committee không hợp lệ"],
            default: null,
        },
        reviewerCode: {
            type: String,
            default: null,
        },
        lifecycleStatus: {
            type: String,
            enum: [
                "draft",
                "funding_active",
                "funding_complete",
                "in_progress",
                "completed",
                "partial_failure",
                "failed",
                "cancelled",
            ],
            default: "funding_active",
        },
        schemaVersion: {
            type: Number,
            default: 2,
        },
        // TODO: Thêm category, tags nếu cần filter nâng cao
    },
    { timestamps: true },
);

// Existing indexes
CampaignSchema.index({ onChainId: 1 });
CampaignSchema.index({ creator: 1 });
CampaignSchema.index({ beneficiary: 1 });
CampaignSchema.index({ status: 1 });

// Phase 3 indexes for milestone system
CampaignSchema.index({ onChainId: 1 }, { unique: true });
CampaignSchema.index({ creator: 1, lifecycleStatus: 1 });
CampaignSchema.index({ lifecycleStatus: 1, updatedAt: -1 });

module.exports =
    mongoose.models.Campaign || mongoose.model("Campaign", CampaignSchema);
