const express = require("express");
const { getAllCampaigns, getCampaignById } = require("../controllers/campaign.controller");

const router = express.Router();

// GET /api/campaigns?status=active
router.get("/", getAllCampaigns);

// GET /api/campaigns/:id  (onChainId)
router.get("/:id", getCampaignById);

module.exports = router;
