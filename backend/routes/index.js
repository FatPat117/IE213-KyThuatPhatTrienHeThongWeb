const express = require("express");
const healthRoutes = require("./health.routes.js");

const router = express.Router();

router.use("/health", healthRoutes);
// Thêm route mới: router.use("/campaigns", campaignRoutes);

module.exports = router;
