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
            required: [true, "Tiêu đề là bắt buộc"],
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
            enum: ["active", "ended", "failed"],
            default: "active",
        },
        // TODO: Thêm category, tags nếu cần filter nâng cao
    },
    { timestamps: true }
);

CampaignSchema.index({ onChainId: 1 });
CampaignSchema.index({ creator: 1 });
CampaignSchema.index({ status: 1 });

module.exports = mongoose.model("Campaign", CampaignSchema);
