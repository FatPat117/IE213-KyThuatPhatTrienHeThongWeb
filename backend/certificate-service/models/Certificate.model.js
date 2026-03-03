const mongoose = require("mongoose");

const CertificateSchema = new mongoose.Schema(
    {
        // ERC-721 Token ID
        tokenId: {
            type: Number,
            required: [true, "tokenId là bắt buộc"],
            unique: true,
        },
        campaignOnChainId: {
            type: Number,
            required: [true, "campaignOnChainId là bắt buộc"],
        },
        ownerWallet: {
            type: String,
            required: [true, "ownerWallet là bắt buộc"],
            lowercase: true,
            trim: true,
            match: [/^0x[a-fA-F0-9]{40}$/, "Địa chỉ ví không hợp lệ"],
        },
        // Link IPFS chứa JSON metadata (name, image, attributes)
        metadataUri: {
            type: String,
            required: [true, "metadataUri là bắt buộc"],
            // TODO: validate format ipfs:// hoặc https://ipfs.io/ipfs/...
        },
        mintedAt: {
            type: Date,
            default: Date.now,
        },
        // TODO: Thêm txHash của lần mint nếu cần audit on-chain
    },
    { timestamps: false }
);

CertificateSchema.index({ ownerWallet: 1 });
CertificateSchema.index({ campaignOnChainId: 1 });

module.exports = mongoose.model("Certificate", CertificateSchema);
