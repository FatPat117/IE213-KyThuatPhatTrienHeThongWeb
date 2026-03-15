const mongoose = require("mongoose");

const CertificateSchema = new mongoose.Schema(
    {
        // ERC-721 token ID.
        tokenId: {
            type: Number,
            required: [true, "tokenId is required"],
            unique: true,
        },
        campaignOnChainId: {
            type: Number,
            required: [true, "campaignOnChainId is required"],
        },
        ownerWallet: {
            type: String,
            required: [true, "ownerWallet is required"],
            lowercase: true,
            trim: true,
            match: [/^0x[a-fA-F0-9]{40}$/, "Invalid wallet address"],
        },
        txHash: {
            type: String,
            default: null,
            lowercase: true,
            trim: true,
            match: [/^0x[a-fA-F0-9]{64}$/, "Invalid txHash"],
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
        // IPFS or data URI that stores metadata JSON (name, image, attributes).
        metadataUri: {
            type: String,
            required: [true, "metadataUri is required"],
            // TODO: validate ipfs:// or gateway URL format.
        },
        displayName: {
            type: String,
            default: "",
            trim: true,
            maxlength: [100, "displayName must be at most 100 characters"],
        },
        campaignTitle: {
            type: String,
            default: "",
            trim: true,
            maxlength: [200, "campaignTitle must be at most 200 characters"],
        },
        donatedAmountEth: {
            type: Number,
            default: 0,
        },
        certificateMessage: {
            type: String,
            default: "",
            trim: true,
        },
        displayName: {
            type: String,
            default: "",
            trim: true,
            maxlength: [100, "displayName tối đa 100 ký tự"],
        },
        campaignTitle: {
            type: String,
            default: "",
            trim: true,
            maxlength: [200, "campaignTitle tối đa 200 ký tự"],
        },
        donatedAmountEth: {
            type: Number,
            default: 0,
        },
        certificateMessage: {
            type: String,
            default: "",
            trim: true,
        },
        mintedAt: {
            type: Date,
            default: Date.now,
        },
        // TODO: consider storing additional mint execution fields if future analytics require them.
    },
    { timestamps: false },
);

CertificateSchema.index({ ownerWallet: 1 });
CertificateSchema.index({ campaignOnChainId: 1 });
CertificateSchema.index({ txHash: 1 });
CertificateSchema.index({ blockNumber: -1 });

module.exports =
    mongoose.models.Certificate ||
    mongoose.model("Certificate", CertificateSchema);
