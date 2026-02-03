const express = require("express");
const { body, validationResult } = require("express-validator");

const router = express.Router();

/**
 * POST /api/donations
 * Lưu lịch sử donation off-chain (sau khi đã quyên góp on-chain)
 * Body: { campaignId, donorAddress, amountEth, transactionHash, blockNumber }
 */
router.post(
    "/",
    [
        body("campaignId").isInt({ min: 0 }).toInt(),
        body("donorAddress")
            .isEthereumAddress()
            .withMessage("Invalid Ethereum address"),
        body("amountEth").isFloat({ min: 0.001 }).toFloat(),
        body("transactionHash")
            .matches(/^0x[a-fA-F0-9]{64}$/)
            .withMessage("Invalid transaction hash"),
        body("blockNumber").isInt({ min: 0 }).toInt(),
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        try {
            const {
                campaignId,
                donorAddress,
                amountEth,
                transactionHash,
                blockNumber,
            } = req.body;

            // TODO: Implement:
            // 1. Store donation record in database
            // 2. Index by campaignId, donorAddress, timestamp
            // 3. Return donation details with ID

            res.status(501).json({
                message: "Endpoint pending implementation",
                note: "Donations are primarily tracked via smart contract events",
                receivedData: {
                    campaignId,
                    donorAddress,
                    amountEth,
                    transactionHash,
                    blockNumber,
                },
            });
        } catch (error) {
            res.status(500).json({
                error: "Failed to record donation",
                message: error.message,
            });
        }
    },
);

/**
 * GET /api/donations/user/:address
 * Lấy lịch sử quyên góp của 1 user
 * Query: page, limit, campaignId (optional)
 */
router.get("/user/:address", async (req, res) => {
    try {
        const { address } = req.params;

        // Validate address format
        if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
            return res.status(400).json({ error: "Invalid Ethereum address" });
        }

        // TODO: Implement:
        // 1. Query donations from database where donorAddress = address
        // 2. Join with campaigns to show campaign details
        // 3. Return paginated results

        res.status(501).json({
            message: "Endpoint pending implementation",
            note: "Donations are queried via contract events in frontend",
            userAddress: address,
        });
    } catch (error) {
        res.status(500).json({
            error: "Failed to fetch user donations",
            message: error.message,
        });
    }
});

/**
 * GET /api/donations/campaign/:campaignId
 * Lấy tất cả donations cho 1 campaign
 * Query: page, limit
 */
router.get("/campaign/:campaignId", async (req, res) => {
    try {
        const { campaignId } = req.params;

        if (isNaN(parseInt(campaignId))) {
            return res.status(400).json({ error: "Invalid campaign ID" });
        }

        // TODO: Implement:
        // 1. Query donations from database where campaignId = campaignId
        // 2. Return paginated results with donor info

        res.status(501).json({
            message: "Endpoint pending implementation",
            note: "Donations are queried via DonationReceived events from contract",
            campaignId: parseInt(campaignId),
        });
    } catch (error) {
        res.status(500).json({
            error: "Failed to fetch campaign donations",
            message: error.message,
        });
    }
});

module.exports = router;
