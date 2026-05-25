const mongoose = require("mongoose");

const DonationSchema = new mongoose.Schema(
    {
        txHash: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
        },
        campaignOnChainId: {
            type: Number,
            required: true,
            index: true,
        },
        donorWallet: {
            type: String,
            required: true,
            lowercase: true,
            trim: true,
            index: true,
        },
        amount: {
            type: String,
            required: true,
            default: "0",
        },
        donatedAt: {
            type: Date,
            default: Date.now,
        },
    },
    { timestamps: false },
);

DonationSchema.index({ campaignOnChainId: 1, donorWallet: 1 });

module.exports =
    mongoose.models.Donation || mongoose.model("Donation", DonationSchema);
