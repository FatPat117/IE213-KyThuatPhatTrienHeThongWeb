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
            enum: [
                "donate", // user donate
                "createCampaign", // user tạo campaign
                "mintNFT", // user mint NFT (nếu có)
                "withdrawFunds", // creator rút tiền về sau khi campaign thành công
                "claimRefund", // user rút tiền về sau khi campaign thất bại
                "cancelCampaign", // creator hủy campaign
                "markAsFailed", // listener/service đánh dấu campaign thất bại nếu deadline trôi qua mà chưa đạt goal
            ],
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
        campaignTitle: {
            type: String,
            trim: true,
            maxlength: [200, "Tên campaign tối đa 200 ký tự"],
            default: "",
        },
        // Ghi lại lý do thất bại (nếu failed)
        errorMessage: {
            type: String,
            default: "",
        },
    },
    { timestamps: true }, // createdAt = lúc pending, updatedAt = lúc success/failed
);

TransactionSchema.index({ walletAddress: 1 });
TransactionSchema.index({ status: 1 });
TransactionSchema.index({ campaignOnChainId: 1 });
TransactionSchema.index({ campaignOnChainId: 1, createdAt: -1 });

module.exports =
    mongoose.models.Transaction ||
    mongoose.model("Transaction", TransactionSchema);
