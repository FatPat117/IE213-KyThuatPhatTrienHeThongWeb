const mongoose = require("mongoose");

const NotificationSchema = new mongoose.Schema(
    {
        recipientWallet: {
            type: String,
            required: [true, "recipientWallet là bắt buộc"],
            lowercase: true,
            trim: true,
            match: [/^0x[a-fA-F0-9]{40}$/, "Địa chỉ ví không hợp lệ"],
        },
        type: {
            type: String,
            enum: [
                "campaign_succeeded", // chiến dịch đạt mục tiêu
                "campaign_failed", // chiến dịch thất bại après deadline
                "campaign_cancelled", // chiến dịch bị hủy
                "funds_withdrawn", // creator đã rút tiền thành công
            ],
            required: [true, "type là bắt buộc"],
        },
        title: {
            type: String,
            default: "",
            trim: true,
            maxlength: [200, "title tối đa 200 ký tự"],
        },
        message: {
            type: String,
            default: "",
            maxlength: [1000, "message tối đa 1000 ký tự"],
        },
        campaignOnChainId: {
            type: Number,
            default: null,
        },
        txHash: {
            type: String,
            default: "",
        },
        read: {
            type: Boolean,
            default: false,
        },
    },
    { timestamps: true },
);

NotificationSchema.index({ recipientWallet: 1, createdAt: -1 });
NotificationSchema.index({ recipientWallet: 1, read: 1 });

module.exports =
    mongoose.models.Notification ||
    mongoose.model("Notification", NotificationSchema);
