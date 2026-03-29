const mongoose = require("mongoose");

const ReviewerSchema = new mongoose.Schema(
    {
        // Unique identifier for reviewer (e.g., "REVIEWER_001", "DISTRICT_A")
        reviewerCode: {
            type: String,
            required: [true, "reviewerCode là bắt buộc"],
            unique: true,
            trim: true,
        },
        // Primary wallet address
        walletAddress: {
            type: String,
            required: [true, "walletAddress là bắt buộc"],
            unique: true,
            lowercase: true,
            trim: true,
            match: [/^0x[a-fA-F0-9]{40}$/, "Địa chỉ ví không hợp lệ"],
        },
        // Is this reviewer active?
        isActive: {
            type: Boolean,
            default: true,
        },
        // Organization/institution name
        organizationName: {
            type: String,
            default: "",
        },
        // Region or area of responsibility
        region: {
            type: String,
            default: "",
        },
        // Audit trail: when wallet addresses change
        walletHistory: {
            type: [
                {
                    oldWallet: {
                        type: String,
                        lowercase: true,
                        trim: true,
                    },
                    newWallet: {
                        type: String,
                        lowercase: true,
                        trim: true,
                    },
                    changedAt: {
                        type: Date,
                        default: Date.now,
                    },
                    changedBy: String, // Admin user who made the change
                },
            ],
            default: [],
        },
    },
    { timestamps: true },
);

// Unique constraints
ReviewerSchema.index({ reviewerCode: 1 }, { unique: true });
ReviewerSchema.index({ walletAddress: 1 }, { unique: true });
// Active reviewer lookup
ReviewerSchema.index({ isActive: 1, region: 1 });

module.exports =
    mongoose.models.Reviewer || mongoose.model("Reviewer", ReviewerSchema);
