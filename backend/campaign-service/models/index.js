/**
 * Models Index
 * Centralizes all model imports for the campaign-service
 * Models are auto-registered with Mongoose when required
 */

const Campaign = require("./campaign.model");
const Milestone = require("./milestone.model");
const ProgressReport = require("./progressReport.model");
const Reviewer = require("./reviewer.model");
const Notification = require("./notification.model");
const CampaignDonorShare = require("./campaignDonorShare.model");
const CampaignRefund = require("./campaignRefund.model");
const Donation = require("./donation.model");

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
