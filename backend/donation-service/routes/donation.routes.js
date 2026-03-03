const express = require("express");
const { getDonationsByCampaign, getDonationsByDonor } = require("../controllers/donation.controller");
const validateAddress = require("../middlewares/validateAddress");

const router = express.Router();

// GET /api/donations/campaign/:id
router.get("/campaign/:id", getDonationsByCampaign);

// GET /api/donations/donor/:wallet
router.get("/donor/:wallet", validateAddress, getDonationsByDonor);

module.exports = router;
