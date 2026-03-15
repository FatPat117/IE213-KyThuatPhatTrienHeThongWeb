const mongoose = require("mongoose");

const TransactionSchema = new mongoose.Schema(
    {
        txHash: {
            type: String,
            required: [true, "txHash is required"],
            unique: true,
            lowercase: true,
            trim: true,
            match: [/^0x[a-fA-F0-9]{64}$/, "Invalid txHash"],
        },
        walletAddress: {
            type: String,
            required: [true, "walletAddress is required"],
            lowercase: true,
            trim: true,
            match: [/^0x[a-fA-F0-9]{40}$/, "Invalid wallet address"],
        },
        action: {
            type: String,
            enum: [
                "donate",
                "createCampaign",
                "mintNFT",
                "withdrawFunds",
                "cancelCampaign",
                "claimRefund",
                "markAsFailed",
            ],
            required: [true, "action is required"],
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
        chainId: {
            type: Number,
            default: null,
        },
        blockNumber: {
            type: Number,
            default: null,
        },
        blockTimestamp: {
            type: Date,
            default: null,
        },
        transactionIndex: {
            type: Number,
            default: null,
        },
        logIndex: {
            type: Number,
            default: null,
        },
        nonce: {
            type: Number,
            default: null,
        },
        fromAddress: {
            type: String,
            default: null,
            lowercase: true,
            trim: true,
            match: [/^0x[a-fA-F0-9]{40}$/, "Invalid fromAddress"],
        },
        toAddress: {
            type: String,
            default: null,
            lowercase: true,
            trim: true,
            match: [/^0x[a-fA-F0-9]{40}$/, "Invalid toAddress"],
        },
        gasUsed: {
            type: String,
            default: null,
        },
        effectiveGasPrice: {
            type: String,
            default: null,
        },
        gasFeeWei: {
            type: String,
            default: null,
        },
        txType: {
            type: Number,
            default: null,
        },
        lastSyncedAt: {
            type: Date,
            default: null,
        },
        // Stores the failure reason when status is failed.
        errorMessage: {
            type: String,
            default: "",
        },
    },
    { timestamps: true }, // createdAt stores the initial pending time, updatedAt tracks the latest status change.
);

TransactionSchema.index({ walletAddress: 1 });
TransactionSchema.index({ status: 1 });
TransactionSchema.index({ campaignOnChainId: 1, createdAt: -1 });
TransactionSchema.index({ txHash: 1, blockNumber: -1 });

module.exports =
    mongoose.models.Transaction ||
    mongoose.model("Transaction", TransactionSchema);
