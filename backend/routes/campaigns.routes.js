const express = require("express");
const { body, param, validationResult } = require("express-validator");

const router = express.Router();

/**
 * GET /api/campaigns
 * Lấy danh sách tất cả campaigns (metadata off-chain)
 * Query: page, limit, status
 */
router.get("/", async (req, res) => {
    try {
        // TODO: Implement với database nếu cần cache campaign metadata off-chain
        // Hiện tại frontend đọc trực tiếp từ blockchain qua contract
        res.status(501).json({
            message: "Endpoint pending implementation",
            note: "Frontend queries campaigns directly from smart contract",
        });
    } catch (error) {
        res.status(500).json({
            error: "Failed to fetch campaigns",
            message: error.message,
        });
    }
});

/**
 * GET /api/campaigns/:id
 * Lấy chi tiết 1 campaign theo ID
 */
router.get("/:id", [param("id").isInt().toInt()], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const { id } = req.params;
        // TODO: Implement với database để lưu campaign metadata off-chain
        res.status(501).json({
            message: "Endpoint pending implementation",
            note: "Campaign details are stored on-chain, queried via smart contract",
            campaignId: id,
        });
    } catch (error) {
        res.status(500).json({
            error: "Failed to fetch campaign",
            message: error.message,
        });
    }
});

/**
 * POST /api/campaigns
 * Tạo campaign metadata off-chain (trước khi gọi smart contract)
 * Body: { title, description, goalEth, durationDays, imageUrl?, category? }
 */
router.post(
    "/",
    [
        body("title")
            .trim()
            .isLength({ min: 5, max: 100 })
            .withMessage("Title must be 5-100 characters"),
        body("description")
            .trim()
            .isLength({ min: 20, max: 500 })
            .withMessage("Description must be 20-500 characters"),
        body("goalEth")
            .isFloat({ min: 0.01 })
            .withMessage("Goal must be at least 0.01 ETH"),
        body("durationDays")
            .isInt({ min: 1, max: 365 })
            .withMessage("Duration must be 1-365 days"),
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        try {
            const { title, description, goalEth, durationDays } = req.body;

            // TODO: Implement campaign creation:
            // 1. Validate user wallet (signature verification)
            // 2. Store campaign metadata in database
            // 3. Return campaign data + prepare for smart contract creation

            res.status(501).json({
                message: "Endpoint pending implementation",
                note: "Campaign creation is done via smart contract createCampaign()",
                receivedData: {
                    title,
                    description,
                    goalEth,
                    durationDays,
                },
            });
        } catch (error) {
            res.status(500).json({
                error: "Failed to create campaign",
                message: error.message,
            });
        }
    },
);

/**
 * GET /api/campaigns/:id/donations
 * Lấy danh sách donors + history donations của 1 campaign
 */
router.get(
    "/:id/donations",
    [param("id").isInt().toInt()],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        try {
            const { id } = req.params;
            // TODO: Implement - query DonationReceived events từ contract
            res.status(501).json({
                message: "Endpoint pending implementation",
                note: "Donations are queried from contract events via Viem/Wagmi",
                campaignId: id,
            });
        } catch (error) {
            res.status(500).json({
                error: "Failed to fetch donations",
                message: error.message,
            });
        }
    },
);

module.exports = router;
