const express = require("express");
const { getCertificatesByOwner, getCertificatesByCampaign } = require("../controllers/certificate.controller");
const validateAddress = require("../middlewares/validateAddress");

const router = express.Router();

// GET /api/certificates/owner/:wallet
router.get("/owner/:wallet", validateAddress, getCertificatesByOwner);

// GET /api/certificates/campaign/:id
router.get("/campaign/:id", getCertificatesByCampaign);

module.exports = router;
