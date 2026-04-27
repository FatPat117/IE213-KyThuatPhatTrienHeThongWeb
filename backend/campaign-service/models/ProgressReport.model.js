const mongoose = require("mongoose");

const ProgressReportSchema = new mongoose.Schema(
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
        // Reference to Milestone document
        milestoneId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Milestone",
            required: [true, "milestoneId là bắt buộc"],
        },
        // Milestone position (1, 2, 3...) for quick lookup
        milestoneIndex: {
            type: Number,
            required: [true, "milestoneIndex là bắt buộc"],
        },
        // Wallet address of the creator submitting evidence
        creatorWallet: {
            type: String,
            required: [true, "creatorWallet là bắt buộc"],
            lowercase: true,
            trim: true,
            match: [/^0x[a-fA-F0-9]{40}$/, "Địa chỉ ví creator không hợp lệ"],
        },
        // IPFS/Pinata CID
        cid: {
            type: String,
            required: [true, "IPFS CID là bắt buộc"],
            unique: true, // One CID = one report
        },
        // Gateway URL for easy access
        gatewayUrl: {
            type: String,
            required: [true, "Gateway URL là bắt buộc"],
        },
        // MIME type (image/jpeg, application/pdf, video/mp4, etc.)
        mimeType: {
            type: String,
            default: "application/octet-stream",
        },
        // Original filename
        fileName: {
            type: String,
            required: [true, "Tên file là bắt buộc"],
        },
        // Timestamp when submitted
        submittedAt: {
            type: Date,
            required: [true, "Thời gian submit là bắt buộc"],
            default: Date.now,
        },
    },
    { timestamps: true },
);

// Query: all reports for a specific milestone (sorted by submission date)
ProgressReportSchema.index({
    campaignOnChainId: 1,
    milestoneIndex: 1,
    submittedAt: -1,
});
// Query: all reports submitted by a creator
ProgressReportSchema.index({ creatorWallet: 1, submittedAt: -1 });
// CID lookup (or prevent duplication)
ProgressReportSchema.index({ cid: 1 }, { unique: true });

module.exports =
    mongoose.models.ProgressReport ||
    mongoose.model("ProgressReport", ProgressReportSchema);
