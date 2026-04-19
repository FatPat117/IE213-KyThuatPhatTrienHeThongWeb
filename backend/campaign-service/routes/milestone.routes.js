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
    createMilestoneForCampaign,
    getMilestonesForCampaign,
    getMilestoneDetail,
    updateMilestone,
    deleteMilestone,
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
    uploadProgressEvidence,
);

/**
 * @swagger
 * /api/milestones/{campaignOnChainId}/{milestoneIndex}/reject:
 *   post:
 *     summary: Reviewer từ chối milestone
 *     description: |
 *       Reviewer gửi lý do từ chối milestone.
 *       Nếu còn trong hạn và còn lượt retry thì milestone chuyển sang `resubmittable`.
 *       Ngược lại milestone chuyển `failed` và có thể trigger cascade refund theo luồng xử lý hệ thống.
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
 *     security:
 *       - ApiKeyHeaderAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [reason]
 *             properties:
 *               reason:
 *                 type: string
 *                 minLength: 10
 *                 example: "Bằng chứng chưa đủ rõ ràng, cần bổ sung tài liệu."
 *     responses:
 *       200: { description: Xử lý reject thành công }
 *       400: { description: Thiếu tham số hoặc reason không hợp lệ }
 *       403: { description: Không có quyền }
 *       404: { description: Campaign hoặc milestone không tồn tại }
 */
router.post("/:campaignOnChainId/:milestoneIndex/reject", rejectMilestone);

/**
 * @swagger
 * /api/milestones/{campaignOnChainId}/{milestoneIndex}/resubmit:
 *   put:
 *     summary: Creator nộp lại milestone sau khi bị từ chối
 *     description: |
 *       Creator có thể resubmit milestone đang ở trạng thái `resubmittable`
 *       khi chưa quá hạn deadline. Có thể đính kèm `evidenceCid` mới.
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
 *     security:
 *       - ApiKeyHeaderAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               evidenceCid:
 *                 type: string
 *                 example: "bafybeigdyrzt..."
 *               ipfsHash:
 *                 type: string
 *                 description: Alias tương thích cho evidenceCid
 *                 example: "bafybeigdyrzt..."
 *     responses:
 *       200: { description: Resubmit thành công }
 *       400: { description: Thiếu tham số }
 *       403: { description: Không có quyền }
 *       404: { description: Campaign hoặc milestone không tồn tại }
 *       409: { description: Milestone không ở trạng thái cho phép hoặc đã quá hạn }
 */
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

// ── CRUD-style Milestone Management ─────────────────────────────

/**
 * @swagger
 * /api/milestones/campaigns/{campaignOnChainId}:
 *   post:
 *     summary: Tạo mới milestone cho campaign
 *     tags: [Milestones]
 *     parameters:
 *       - in: path
 *         name: campaignOnChainId
 *         required: true
 *         schema: { type: string }
 *     security:
 *       - ApiKeyHeaderAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, financialTargetWei, deadline]
 *             properties:
 *               milestoneIndex: { type: number, example: 1 }
 *               title: { type: string, example: "Mốc 1 - Khảo sát hiện trạng" }
 *               description: { type: string, example: "Khảo sát và tổng hợp nhu cầu thực tế." }
 *               financialTargetWei: { type: string, example: "1000000000000000000" }
 *               deadline: { type: string, format: date-time, example: "2026-06-30T23:59:59.000Z" }
 *     responses:
 *       201: { description: Tạo milestone thành công }
 *       400: { description: Dữ liệu không hợp lệ }
 *       403: { description: Không có quyền }
 *       404: { description: Campaign không tồn tại }
 */
router.post("/campaigns/:campaignOnChainId", createMilestoneForCampaign);

/**
 * @swagger
 * /api/milestones/campaigns/{campaignOnChainId}:
 *   get:
 *     summary: Lấy danh sách milestone của campaign
 *     tags: [Milestones]
 *     parameters:
 *       - in: path
 *         name: campaignOnChainId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Thành công }
 *       404: { description: Campaign không tồn tại }
 */
router.get("/campaigns/:campaignOnChainId", getMilestonesForCampaign);

/**
 * @swagger
 * /api/milestones/campaigns/{campaignOnChainId}/{milestoneIndex}:
 *   get:
 *     summary: Lấy chi tiết 1 milestone theo campaign và index
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
 *     responses:
 *       200: { description: Thành công }
 *       404: { description: Milestone không tồn tại }
 */
router.get(
    "/campaigns/:campaignOnChainId/:milestoneIndex",
    getMilestoneDetail,
);

/**
 * @swagger
 * /api/milestones/campaigns/{campaignOnChainId}/{milestoneIndex}:
 *   put:
 *     summary: Cập nhật thông tin milestone
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
 *     security:
 *       - ApiKeyHeaderAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title: { type: string }
 *               description: { type: string }
 *               financialTargetWei: { type: string }
 *               deadline: { type: string, format: date-time }
 *               status:
 *                 type: string
 *                 enum:
 *                   - pending_funding
 *                   - pending_verification
 *                   - submitted
 *                   - resubmittable
 *                   - deadline_exceeded
 *                   - review_timeout
 *                   - approved
 *                   - disbursed
 *                   - failed
 *                   - refunded
 *     responses:
 *       200: { description: Cập nhật thành công }
 *       400: { description: Dữ liệu không hợp lệ }
 *       403: { description: Không có quyền }
 *       404: { description: Campaign hoặc milestone không tồn tại }
 */
router.put(
    "/campaigns/:campaignOnChainId/:milestoneIndex",
    updateMilestone,
);

/**
 * @swagger
 * /api/milestones/campaigns/{campaignOnChainId}/{milestoneIndex}:
 *   delete:
 *     summary: Xóa milestone khỏi campaign
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
 *     security:
 *       - ApiKeyHeaderAuth: []
 *     responses:
 *       200: { description: Xóa thành công }
 *       403: { description: Không có quyền }
 *       404: { description: Campaign hoặc milestone không tồn tại }
 */
router.delete(
    "/campaigns/:campaignOnChainId/:milestoneIndex",
    deleteMilestone,
);

module.exports = router;
