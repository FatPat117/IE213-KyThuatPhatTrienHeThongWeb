const express = require("express");
const { getUserProfile, upsertUserProfile } = require("../controllers/user.controller");
const validateAddress = require("../middlewares/validateAddress");

const router = express.Router();

// GET /api/users/:wallet
router.get("/:wallet", validateAddress, getUserProfile);

// PUT /api/users/:wallet
router.put("/:wallet", validateAddress, upsertUserProfile);

module.exports = router;
