const mongoose = require("mongoose");

const TransactionSchema = new mongoose.Schema(
    {
        txHash: {
            type: String,
            required: [true, "txHash là bắt buộc"],
            unique: true,
            lowercase: true,
            trim: true,
            match: [/^0x[a-fA-F0-9]{64}$/, "txHash không hợp lệ"],
        },
        walletAddress: {
            type: String,
            required: [true, "walletAddress là bắt buộc"],
            lowercase: true,
            trim: true,
            match: [/^0x[a-fA-F0-9]{40}$/, "Địa chỉ ví không hợp lệ"],
        },
        action: {
            type: String,
            enum: ["donate", "createCampaign", "mintNFT"],
            required: [true, "action là bắt buộc"],
        },
        status: {
            type: String,
            enum: ["pending", "success", "failed"],
            default: "pending",
        },
        campaignOnChainId: {
            type: Number,
            default: null,
        },
        // Ghi lại lý do thất bại (nếu failed)
        errorMessage: {
            type: String,
            default: "",
        },
    },
    { timestamps: true } // createdAt = lúc pending, updatedAt = lúc success/failed
);

TransactionSchema.index({ walletAddress: 1 });
TransactionSchema.index({ status: 1 });

module.exports = mongoose.model("Transaction", TransactionSchema);
