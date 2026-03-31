const express = require("express");
const multer = require("multer");
const {
    uploadProgressEvidence,
    getContributionAllocation,
    getRefundInfo,
    prepareRefund,
    getProgressReports,
    rejectMilestone,
    resubmitMilestone,
} = require("../controllers/milestone.controller");

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB max
    },
});

/**
 * @swagger
 * tags:
 *   name: Milestones
 *   description: API quản lý milestone và bằng chứng tiến độ
 */

// ── Evidence Upload ──────────────────────────────────────────

/**
 * @swagger
 * /api/milestones/{campaignOnChainId}/{milestoneIndex}/evidence:
 *   post:
 *     summary: Upload progress report evidence to IPFS
 *     tags: [Milestones]
 *     parameters:
 *       - in: path
 *         name: campaignOnChainId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: milestoneIndex
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               evidenceType:
 *                 type: string
 *                 enum: [report, photo, video, document]
 *     responses:
 *       200: { description: Upload thành công }
 *       403: { description: Không có quyền }
 *       404: { description: Campaign hoặc milestone không tìm thấy }
 *       503: { description: IPFS upload thất bại }
 */
router.post(
    "/:campaignOnChainId/:milestoneIndex/evidence",
    upload.single("file"),
    uploadProgressEvidence,
);

router.post("/:campaignOnChainId/:milestoneIndex/reject", rejectMilestone);
router.put("/:campaignOnChainId/:milestoneIndex/resubmit", resubmitMilestone);

// ── Contribution Query ───────────────────────────────────────

/**
 * @swagger
 * /api/campaigns/{campaignOnChainId}/milestones/{milestoneIndex}/contributions/{donorAddress}:
 *   get:
 *     summary: Lấy phân bổ đóng góp của donor cho milestone
 *     tags: [Milestones]
 *     parameters:
 *       - in: path
 *         name: campaignOnChainId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: milestoneIndex
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: donorAddress
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Thành công }
 *       404: { description: Phân bổ chưa được tính hoặc donor không đóng góp }
 */
router.get(
    "/campaigns/:campaignOnChainId/milestones/:milestoneIndex/contributions/:donorAddress",
    getContributionAllocation,
);

// ── Refund Eligibility ───────────────────────────────────────

/**
 * @swagger
 * /api/campaigns/{campaignId}/milestones/{milestoneId}/refund-info:
 *   get:
 *     summary: Kiểm tra khả năng hoàn tiền cho donor
 *     tags: [Milestones]
 *     parameters:
 *       - in: path
 *         name: campaignId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: milestoneId
 *         required: true
 *         schema: { type: string }
 *     security:
 *       - ApiKeyHeaderAuth: []
 *     responses:
 *       200: { description: Thành công }
 *       403: { description: Không có quyền }
 *       404: { description: Campaign hoặc milestone không tìm thấy }
 */
router.get(
    "/campaigns/:campaignId/milestones/:milestoneId/refund-info",
    getRefundInfo,
);

// ── Refund Preparation ───────────────────────────────────────

/**
 * @swagger
 * /api/campaigns/{campaignId}/milestones/{milestoneId}/refund/prepare:
 *   post:
 *     summary: Chuẩn bị payload giao dịch hoàn tiền
 *     tags: [Milestones]
 *     parameters:
 *       - in: path
 *         name: campaignId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: milestoneId
 *         required: true
 *         schema: { type: string }
 *     security:
 *       - ApiKeyHeaderAuth: []
 *     responses:
 *       200: { description: Thành công }
 *       403: { description: Không có quyền }
 *       409: { description: Không đủ điều kiện hoàn tiền }
 */
router.post(
    "/campaigns/:campaignId/milestones/:milestoneId/refund/prepare",
    prepareRefund,
);

// ── Progress Reports ─────────────────────────────────────────

/**
 * @swagger
 * /api/campaigns/{campaignId}/milestones/{milestoneId}/progress-reports:
 *   get:
 *     summary: Lấy danh sách bằng chứng tiến độ của milestone
 *     tags: [Milestones]
 *     parameters:
 *       - in: path
 *         name: campaignId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: milestoneId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Thành công }
 *       404: { description: Campaign hoặc milestone không tìm thấy }
 */
router.get(
    "/campaigns/:campaignId/milestones/:milestoneId/progress-reports",
    getProgressReports,
);

module.exports = router;
