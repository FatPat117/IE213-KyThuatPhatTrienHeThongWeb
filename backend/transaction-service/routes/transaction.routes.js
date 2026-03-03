const express = require("express");
const { createTransaction, updateStatus, getByWallet } = require("../controllers/transaction.controller");
const validateAddress = require("../middlewares/validateAddress");

const router = express.Router();

// POST /api/transactions  – tạo transaction với status pending
router.post("/", createTransaction);

// PATCH /api/transactions/:txHash/status  – listener-service cập nhật sau khi blockchain confirm
router.patch("/:txHash/status", updateStatus);

// GET /api/transactions/:wallet  – lịch sử transactions theo wallet
router.get("/:wallet", validateAddress, getByWallet);

module.exports = router;
