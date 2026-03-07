const mongoose = require("mongoose");

const DonationSchema = new mongoose.Schema(
    {
        // Khóa thực tế là txHash blockchain – đảm bảo không duplicate
        txHash: {
            type: String,
            required: [true, "txHash là bắt buộc"],
            unique: true,
            lowercase: true,
            trim: true,
            match: [/^0x[a-fA-F0-9]{64}$/, "txHash không hợp lệ"],
        },
        campaignOnChainId: {
            type: Number,
            required: [true, "campaignOnChainId là bắt buộc"],
            index: true,
        },
        donorWallet: {
            type: String,
            required: [true, "donorWallet là bắt buộc"],
            lowercase: true,
            trim: true,
            match: [/^0x[a-fA-F0-9]{40}$/, "Địa chỉ ví không hợp lệ"],
        },
        // Lưu cả wei (String, tránh precision loss) và ETH (Number) để tiện sort/filter
        amount: {
            type: String,
            required: [true, "amount (wei) là bắt buộc"],
        },
        amountEth: {
            type: Number,
            required: [true, "amountEth là bắt buộc"],
        },
        // Lời nhắn – chỉ lưu off-chain, không có trên blockchain
        message: {
            type: String,
            default: "",
            maxlength: [500, "Lời nhắn tối đa 500 ký tự"],
        },
        donatedAt: {
            type: Date,
            default: Date.now,
        },
    },
    { timestamps: false }
);

DonationSchema.index({ campaignOnChainId: 1 });
DonationSchema.index({ donorWallet: 1 });

module.exports = mongoose.model("Donation", DonationSchema);
