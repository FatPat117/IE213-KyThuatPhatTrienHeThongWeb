/**
 * Models Index
 * Centralizes all model imports for the campaign-service
 * Models are auto-registered with Mongoose when required
 */

const Campaign = require("./Campaign.model");
const Milestone = require("./Milestone.model");
const ProgressReport = require("./ProgressReport.model");
const Reviewer = require("./Reviewer.model");
const Notification = require("./Notification.model");
const CampaignDonorShare = require("./CampaignDonorShare.model");
const CampaignRefund = require("./CampaignRefund.model");
const Donation = require("./Donation.model");

module.exports = {
    Campaign,
    Milestone,
    ProgressReport,
    Reviewer,
    Notification,
    CampaignDonorShare,
    CampaignRefund,
    Donation,
};
