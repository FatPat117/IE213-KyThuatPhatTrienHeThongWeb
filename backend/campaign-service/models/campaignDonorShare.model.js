const mongoose = require("mongoose");

// CampaignDonorShare: lưu tỷ lệ đóng góp của donor trên toàn campaign
// Dùng làm dữ liệu nền để tính refund khi milestone fail dựa trên remaining pool.
const CampaignDonorShareSchema = new mongoose.Schema(
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
        // Donor wallet address
        donorAddress: {
            type: String,
            required: [true, "donorAddress là bắt buộc"],
            lowercase: true,
            trim: true,
            match: [/^0x[a-fA-F0-9]{40}$/, "Địa chỉ ví donor không hợp lệ"],
        },
        // Total amount donor has contributed to the campaign (wei)
        donorTotalContributionWei: {
            type: String,
            required: [true, "donorTotalContributionWei là bắt buộc"],
            default: "0",
        },
        // Campaign total raised snapshot at FundingComplete (wei)
        campaignTotalRaisedWei: {
            type: String,
            required: [true, "campaignTotalRaisedWei là bắt buộc"],
            default: "0",
        },
        // Donor share in campaign (bps)
        // Example: donor đóng 10% campaign => 1000
        donorShareInCampaignBps: {
            type: Number,
            default: 0,
            min: [0, "Ratio không thể âm"],
            max: [10000, "Ratio không thể vượt quá 10000 (100%)"],
        },
        // Snapshot timestamp when donor share is computed
        computedAt: {
            type: Date,
            required: [true, "computedAt là bắt buộc"],
            default: Date.now,
        },
    },
    { timestamps: true },
);

// Unique constraint: one donor share per (campaign, donor)
CampaignDonorShareSchema.index(
    { campaignId: 1, donorAddress: 1 },
    { unique: true },
);
// Alternative unique constraint using on-chain IDs
CampaignDonorShareSchema.index(
    { campaignOnChainId: 1, donorAddress: 1 },
    { unique: true },
);
// Query: all campaigns of one donor
CampaignDonorShareSchema.index({
    donorAddress: 1,
    computedAt: -1,
});

module.exports =
    mongoose.models.CampaignDonorShare ||
    mongoose.model("CampaignDonorShare", CampaignDonorShareSchema);
