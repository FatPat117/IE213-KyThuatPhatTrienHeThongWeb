const mongoose = require("mongoose");

/**
 * Auth-service dùng chung MongoDB ie213_users với user-service.
 * Schema này phải đồng bộ với user-service/models/User.model.js
 */
const UserSchema = new mongoose.Schema(
    {
        walletAddress: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
            match: [/^0x[a-fA-F0-9]{40}$/, "Địa chỉ ví không hợp lệ"],
        },
        displayName: {
            type: String,
            trim: true,
            maxlength: 100,
            default: "",
        },
        avatarUrl: {
            type: String,
            default: "",
        },
        role: {
            type: String,
            enum: ["guest", "user", "admin"],
            default: "user",
        },
        nonce: {
            type: String,
            default: "",
        },
    },
    { timestamps: true }
);

UserSchema.index({ walletAddress: 1 });

module.exports = mongoose.model("User", UserSchema);
