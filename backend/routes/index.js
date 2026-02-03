const express = require("express");
const healthRoutes = require("./health.routes.js");
const campaignRoutes = require("./campaigns.routes.js");
const donationRoutes = require("./donations.routes.js");

const router = express.Router();

router.use("/health", healthRoutes);
router.use("/campaigns", campaignRoutes);
router.use("/donations", donationRoutes);

module.exports = router;
