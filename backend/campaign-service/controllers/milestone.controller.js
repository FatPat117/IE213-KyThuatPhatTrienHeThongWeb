const {
    ProgressReport,
    Campaign,
    Milestone,
    CampaignDonorShare,
} = require("../models");
const uploadService = require("../services/uploadService");
const refundService = require("../services/refundService");
const {
    calculateDeadline,
    isDeadlineExceeded,
    getTimeRemaining,
} = require("../utils/deadlineHelper");
const { publishMilestoneFailed } = require("../utils/publishMilestoneFailed");
const { successRes, errorRes } = require("../utils/response");

function toBigIntWei(value) {
    try {
        const s = String(value ?? "0").trim();
        return BigInt(s || "0");
    } catch {
        return 0n;
    }
}

/**
 * Milestone Controller
 * Handles milestone-specific operations: evidence upload, refund checks, etc.
 */

/**
 * POST /api/milestones/:campaignOnChainId/:milestoneIndex/evidence
 * Upload progress report evidence to IPFS
 *
 * Body: {title, description, evidenceType}
 * File: multipart form-data with 'file' field
 */
const uploadProgressEvidence = async (req, res) => {
    try {
        const { campaignOnChainId, milestoneIndex } = req.params;
        const { title, description, evidenceType = "report" } = req.body || {};
        const creatorAddress = req.headers["x-wallet-address"];
        const file = req.file;

        // Validation
        if (!campaignOnChainId || milestoneIndex === undefined || milestoneIndex === null) {
            return errorRes(res, "campaignOnChainId and milestoneIndex required", 400);
        }

        if (!file || !file.buffer) {
            return errorRes(res, "file is required (multipart field: file)", 400);
        }

        if (!creatorAddress) {
            return errorRes(res, "x-wallet-address header required", 403);
        }

        // Find campaign and milestone
        const campaign = await Campaign.findOne({
            onChainId: parseInt(campaignOnChainId),
        });

        if (!campaign) {
            return errorRes(
                res,
                `Campaign with onChainId ${campaignOnChainId} not found`,
                404,
            );
        }

        const normalizedMilestoneIndex = Number.parseInt(milestoneIndex, 10);
        if (!Number.isFinite(normalizedMilestoneIndex) || normalizedMilestoneIndex < 0) {
            return errorRes(res, "milestoneIndex must be a non-negative integer", 400);
        }

        let milestone = await Milestone.findOne({
            campaignId: campaign._id,
            $or: [
                { milestoneIndex: normalizedMilestoneIndex },
                { milestoneId: normalizedMilestoneIndex },
            ],
        });

        // Self-heal missing milestone docs (indexer lag): create placeholder milestone row
        // so evidence upload does not fail when on-chain campaign already has that milestone.
        if (!milestone) {
            const onChainMilestoneCount = Number(campaign.milestoneCount || 0);
            const canAutoCreateMilestone =
                normalizedMilestoneIndex >= 0 &&
                (!Number.isFinite(onChainMilestoneCount) ||
                    onChainMilestoneCount <= 0 ||
                    normalizedMilestoneIndex < onChainMilestoneCount);

            if (canAutoCreateMilestone) {
                milestone = await Milestone.findOneAndUpdate(
                    {
                        campaignOnChainId: Number.parseInt(campaignOnChainId, 10),
                        milestoneId: normalizedMilestoneIndex,
                    },
                    {
                        $set: {
                            campaignId: campaign._id,
                            campaignOnChainId: Number.parseInt(campaignOnChainId, 10),
                            milestoneId: normalizedMilestoneIndex,
                            milestoneIndex: normalizedMilestoneIndex,
                        },
                        $setOnInsert: {
                            allocationBps: 0,
                            financialTargetWei: "0",
                            deadline: campaign.deadline,
                            status: "pending_funding",
                            title: "",
                            description: "",
                            reportCids: [],
                            evidenceCids: [],
                        },
                    },
                    {
                        new: true,
                        upsert: true,
                        runValidators: true,
                    },
                );
            }
        }

        if (!milestone) {
            return errorRes(
                res,
                `Milestone ${milestoneIndex} in campaign ${campaignOnChainId} not found`,
                404,
            );
        }

        // Authorization: only campaign creator can upload evidence
        if (campaign.creator.toLowerCase() !== creatorAddress.toLowerCase()) {
            return errorRes(res, "Only campaign creator can upload evidence", 403);
        }

        const pinataGatewayUrl = process.env.PINATA_GATEWAY_URL || "https://gateway.pinata.cloud";
        const originalName = file.originalname || "evidence";
        const safeTitle = (title || "").trim() || "Báo cáo minh chứng";

        const { cid, ipfsUrl, pinataUrl } = await uploadService.uploadToIPFS(
            file.buffer,
            originalName,
            {
                campaignOnChainId: String(campaignOnChainId),
                milestoneIndex: String(milestoneIndex),
                evidenceType: String(evidenceType),
            },
        );

        console.log(
            `[milestoneController.uploadProgressEvidence] IPFS ok: campaign=${campaignOnChainId}, milestone=${milestoneIndex}, cid=${cid}`,
        );

        const progressReport = new ProgressReport({
            campaignId: campaign._id,
            campaignOnChainId: parseInt(campaignOnChainId, 10),
            milestoneId: milestone._id,
            milestoneIndex: parseInt(milestoneIndex, 10),
            creatorWallet: creatorAddress.toLowerCase(),
            cid,
            gatewayUrl: pinataUrl || ipfsUrl || `${pinataGatewayUrl}/ipfs/${cid}`,
            mimeType: file.mimetype || "application/octet-stream",
            fileName: originalName,
            submittedAt: new Date(),
        });

        await progressReport.save();

        const submittedAt = new Date();
        await Milestone.findByIdAndUpdate(milestone._id, {
            $push: {
                reportCids: { cid, submittedAt },
                evidenceCids: cid,
            },
        });

        const payload = {
            _id: progressReport._id,
            evidenceCid: cid,
            cid,
            ipfsCid: cid,
            campaignOnChainId: parseInt(campaignOnChainId, 10),
            milestoneIndex: parseInt(milestoneIndex, 10),
            creatorAddress,
            title: safeTitle,
            description: (description || "").trim(),
            contentHash: cid,
            ipfsUrl,
            pinataUrl: progressReport.pinataUrl,
            evidenceType,
            submittedAt: progressReport.submittedAt,
            status: "submitted",
        };

        return successRes(res, payload);
    } catch (error) {
        console.error(
            `[milestoneController.uploadProgressEvidence] Error: ${error.message}`,
        );

        if (
            error.message.includes("PINATA") ||
            error.message.includes("IPFS")
        ) {
            return errorRes(res, `IPFS upload failed: ${error.message}`, 503);
        }

        return errorRes(res, error.message, 500);
    }
};

/**
 * GET /api/campaigns/:campaignOnChainId/milestones/:milestoneIndex/contributions/:donorAddress
 * Get donor's allocation for a specific milestone
 */
const getContributionAllocation = async (req, res) => {
    try {
        const { campaignOnChainId, milestoneIndex, donorAddress } = req.params;

        // Validation
        if (!campaignOnChainId || !milestoneIndex || !donorAddress) {
            return res.status(400).json({
                status: "error",
                code: "INVALID_PARAMS",
                message:
                    "campaignOnChainId, milestoneIndex, and donorAddress required",
            });
        }

        // Validate address format (basic EVM address check)
        if (!donorAddress.startsWith("0x") || donorAddress.length !== 42) {
            return res.status(400).json({
                status: "error",
                code: "INVALID_ADDRESS",
                message: "Invalid EVM address format",
            });
        }

        // Find campaign
        const campaign = await Campaign.findOne({
            onChainId: parseInt(campaignOnChainId),
        });

        if (!campaign) {
            return res.status(404).json({
                status: "error",
                code: "CAMPAIGN_NOT_FOUND",
                message: `Campaign with onChainId ${campaignOnChainId} not found`,
            });
        }

        // Find milestone
        const milestone = await Milestone.findOne({
            campaignId: campaign._id,
            milestoneIndex: parseInt(milestoneIndex),
        });

        if (!milestone) {
            return res.status(404).json({
                status: "error",
                code: "MILESTONE_NOT_FOUND",
                message: `Milestone ${milestoneIndex} not found in this campaign`,
            });
        }

        // Find campaign donor share (allocation snapshot at FundingComplete)
        const donorShare = await CampaignDonorShare.findOne({
            campaignId: campaign._id,
            donorAddress: donorAddress.toLowerCase(),
        });

        if (!donorShare) {
            return res.status(404).json({
                status: "error",
                code: "ALLOCATION_NOT_FOUND",
                message:
                    "Allocation not computed yet or donor has no contribution. " +
                    "Campaign must reach FundingComplete status first.",
            });
        }

        return res.status(200).json({
            status: "success",
            data: {
                campaignOnChainId,
                milestoneIndex,
                donorAddress: donorAddress.toLowerCase(),
                donorTotalContributionWei: donorShare.donorTotalContributionWei,
                campaignTotalRaisedWei: donorShare.campaignTotalRaisedWei,
                donorShareInCampaignBps: donorShare.donorShareInCampaignBps,
                computedAt: donorShare.computedAt,
            },
        });
    } catch (error) {
        console.error(
            `[milestoneController.getContributionAllocation] Error: ${error.message}`,
        );
        return res.status(500).json({
            status: "error",
            code: "INTERNAL_ERROR",
            message: error.message,
        });
    }
};

/**
 * GET /api/campaigns/:campaignId/milestones/:milestoneId/refund-info
 * Check refund eligibility for a donor
 */
const getRefundInfo = async (req, res) => {
    try {
        const { campaignId, milestoneId } = req.params;
        const donorAddress = req.headers["x-wallet-address"];

        // Validation
        if (!donorAddress) {
            return res.status(403).json({
                status: "error",
                code: "PERMISSION_DENIED",
                message: "x-wallet-address header required",
            });
        }

        if (!campaignId || !milestoneId) {
            return res.status(400).json({
                status: "error",
                code: "INVALID_PARAMS",
                message: "campaignId and milestoneId required",
            });
        }

        // Check eligibility
        const eligibility = await refundService.checkRefundEligibility(
            campaignId,
            milestoneId,
            donorAddress.toLowerCase(),
        );

        console.log(
            `[milestoneController.getRefundInfo] campaign=${campaignId}, ` +
            `milestone=${milestoneId}, donor=${donorAddress}, eligible=${eligibility.eligible}`,
        );

        return res.status(200).json({
            status: "success",
            data: {
                eligible: eligibility.eligible,
                campaignId,
                milestoneId,
                donorAddress: donorAddress.toLowerCase(),
                refundableWei: eligibility.refundableWei,
                alreadyRefunded: eligibility.alreadyRefunded,
                reason: eligibility.reason,
            },
        });
    } catch (error) {
        console.error(
            `[milestoneController.getRefundInfo] Error: ${error.message}`,
        );
        return res.status(500).json({
            status: "error",
            code: "INTERNAL_ERROR",
            message: error.message,
        });
    }
};

/**
 * POST /api/campaigns/:campaignId/milestones/:milestoneId/refund/prepare
 * Prepare refund transaction payload
 */
const prepareRefund = async (req, res) => {
    try {
        const { campaignId, milestoneId } = req.params;
        const donorAddress = req.headers["x-wallet-address"];
        const { donorAddress: bodyDonorAddress } = req.body || {};

        // Validation
        if (!donorAddress) {
            return res.status(403).json({
                status: "error",
                code: "PERMISSION_DENIED",
                message: "x-wallet-address header required",
            });
        }

        // If body specifies donorAddress, it must match header
        if (
            bodyDonorAddress &&
            bodyDonorAddress.toLowerCase() !== donorAddress.toLowerCase()
        ) {
            return res.status(403).json({
                status: "error",
                code: "PERMISSION_DENIED",
                message: "Cannot prepare refund for someone else's wallet",
            });
        }

        if (!campaignId || !milestoneId) {
            return res.status(400).json({
                status: "error",
                code: "INVALID_PARAMS",
                message: "campaignId and milestoneId required",
            });
        }

        // Prepare refund transaction
        const refundPayload = await refundService.prepareRefundTx(
            campaignId,
            milestoneId,
            donorAddress.toLowerCase(),
            {
                address: process.env.FUNDING_PLATFORM_CONTRACT,
                chainId: parseInt(process.env.CHAIN_ID || 11155111),
                method: "claimMilestoneRefund",
            },
        );

        console.log(
            `[milestoneController.prepareRefund] SUCCESS: ` +
            `prepareRequestId=${refundPayload.prepareRequestId}`,
        );

        return res.status(200).json({
            status: "success",
            data: refundPayload,
        });
    } catch (error) {
        console.error(
            `[milestoneController.prepareRefund] Error: ${error.message}`,
        );

        // Determine error type
        if (error.message.includes("not eligible")) {
            return res.status(409).json({
                status: "error",
                code: "NOT_ELIGIBLE",
                message: error.message,
            });
        }

        if (error.message.includes("not found")) {
            return res.status(404).json({
                status: "error",
                code: "NOT_FOUND",
                message: error.message,
            });
        }

        return res.status(500).json({
            status: "error",
            code: "INTERNAL_ERROR",
            message: error.message,
        });
    }
};

/**
 * GET /api/campaigns/:campaignId/milestones/:milestoneId/progress-reports
 * Get all progress reports for a milestone
 */
const getProgressReports = async (req, res) => {
    try {
        const { campaignId, milestoneId } = req.params;

        const reports = await ProgressReport.find({
            campaignId,
            milestoneId,
        }).sort({ submittedAt: -1 });

        return res.status(200).json({
            status: "success",
            data: reports,
        });
    } catch (error) {
        console.error(
            `[milestoneController.getProgressReports] Error: ${error.message}`,
        );
        return res.status(500).json({
            status: "error",
            code: "INTERNAL_ERROR",
            message: error.message,
        });
    }
};

/**
 * GET /api/campaigns/:campaignId/refund-info
 * Campaign-level refund eligibility for donor
 */
const getCampaignRefundInfo = async (req, res) => {
    try {
        const { campaignId } = req.params;
        const donorAddress = req.headers["x-wallet-address"];

        if (!donorAddress) {
            return res.status(403).json({
                status: "error",
                code: "PERMISSION_DENIED",
                message: "x-wallet-address header required",
            });
        }

        if (!campaignId) {
            return res.status(400).json({
                status: "error",
                code: "INVALID_PARAMS",
                message: "campaignId required",
            });
        }

        const eligibility = await refundService.checkCampaignRefundEligibility(
            campaignId,
            donorAddress.toLowerCase(),
        );

        return res.status(200).json({
            status: "success",
            data: {
                campaignId,
                donorAddress: donorAddress.toLowerCase(),
                eligible: eligibility.eligible,
                refundableWei: eligibility.refundableWei,
                alreadyRefunded: eligibility.alreadyRefunded,
                reason: eligibility.reason,
                mode: eligibility.mode,
                operations: eligibility.operations,
            },
        });
    } catch (error) {
        console.error(
            `[milestoneController.getCampaignRefundInfo] Error: ${error.message}`,
        );
        return res.status(500).json({
            status: "error",
            code: "INTERNAL_ERROR",
            message: error.message,
        });
    }
};

/**
 * POST /api/campaigns/:campaignId/refund/prepare
 * Prepare campaign-level refund transaction payload (compat mode)
 */
const prepareCampaignRefund = async (req, res) => {
    try {
        const { campaignId } = req.params;
        const donorAddress = req.headers["x-wallet-address"];
        const { donorAddress: bodyDonorAddress } = req.body || {};

        if (!donorAddress) {
            return res.status(403).json({
                status: "error",
                code: "PERMISSION_DENIED",
                message: "x-wallet-address header required",
            });
        }

        if (
            bodyDonorAddress &&
            bodyDonorAddress.toLowerCase() !== donorAddress.toLowerCase()
        ) {
            return res.status(403).json({
                status: "error",
                code: "PERMISSION_DENIED",
                message: "Cannot prepare refund for someone else's wallet",
            });
        }

        if (!campaignId) {
            return res.status(400).json({
                status: "error",
                code: "INVALID_PARAMS",
                message: "campaignId required",
            });
        }

        const payload = await refundService.prepareCampaignRefundTx(
            campaignId,
            donorAddress.toLowerCase(),
            {
                address:
                    process.env.CROWDFUNDING_CONTRACT_ADDRESS ||
                    process.env.FUNDING_PLATFORM_CONTRACT,
                chainId: parseInt(process.env.CHAIN_ID || 11155111),
            },
        );

        return res.status(200).json({
            status: "success",
            data: payload,
        });
    } catch (error) {
        console.error(
            `[milestoneController.prepareCampaignRefund] Error: ${error.message}`,
        );

        if (error.message.includes("not eligible")) {
            return res.status(409).json({
                status: "error",
                code: "NOT_ELIGIBLE",
                message: error.message,
            });
        }

        if (error.message.includes("not found")) {
            return res.status(404).json({
                status: "error",
                code: "NOT_FOUND",
                message: error.message,
            });
        }

        return res.status(500).json({
            status: "error",
            code: "INTERNAL_ERROR",
            message: error.message,
        });
    }
};

/**
 * POST /api/milestones/:campaignOnChainId/:milestoneIndex/reject
 * Reviewer rejects milestone.
 *
 * If still within deadline (+grace) and retry remains => resubmittable.
 * Otherwise => failed and cascade campaign refund.
 */
const rejectMilestone = async (req, res) => {
    try {
        const { campaignOnChainId, milestoneIndex } = req.params;
        const reviewerWallet = req.headers["x-wallet-address"];
        const reason = (req.body?.reason || "").trim();

        if (!campaignOnChainId || !milestoneIndex) {
            return res.status(400).json({
                status: "error",
                code: "INVALID_PARAMS",
                message: "campaignOnChainId and milestoneIndex required",
            });
        }

        if (!reviewerWallet) {
            return res.status(403).json({
                status: "error",
                code: "PERMISSION_DENIED",
                message: "x-wallet-address header required",
            });
        }

        if (reason.length < 10) {
            return res.status(400).json({
                status: "error",
                code: "INVALID_REASON",
                message: "Rejection reason must be at least 10 characters",
            });
        }

        const campaign = await Campaign.findOne({
            onChainId: Number(campaignOnChainId),
        });
        if (!campaign) {
            return res.status(404).json({
                status: "error",
                code: "CAMPAIGN_NOT_FOUND",
                message: `Campaign ${campaignOnChainId} not found`,
            });
        }

        const assignedReviewerSafe = (campaign.reviewerSafe || "")
            .trim()
            .toLowerCase();
        if (
            !assignedReviewerSafe ||
            assignedReviewerSafe !== reviewerWallet.toLowerCase()
        ) {
            return res.status(403).json({
                status: "error",
                code: "PERMISSION_DENIED",
                message: "Only assigned reviewerSafe can reject this milestone",
            });
        }

        const milestone = await Milestone.findOne({
            campaignId: campaign._id,
            milestoneIndex: Number(milestoneIndex),
        });
        if (!milestone) {
            return res.status(404).json({
                status: "error",
                code: "MILESTONE_NOT_FOUND",
                message: `Milestone ${milestoneIndex} not found`,
            });
        }

        const deadlineExceeded = isDeadlineExceeded(milestone.deadline);
        const retriesLeft =
            Number(milestone.maxRetries || 3) -
            Number(milestone.rejectionCount || 0);

        if (!deadlineExceeded && retriesLeft > 0) {
            milestone.status = "resubmittable";
            milestone.rejectionCount =
                Number(milestone.rejectionCount || 0) + 1;
            milestone.lastRejectionReason = reason;
            milestone.lastRejectionTimestamp = new Date();
            milestone.rejectionHistory.push({
                timestamp: new Date(),
                reason,
                reviewerWallet: reviewerWallet.toLowerCase(),
            });

            await milestone.save();

            const remaining = getTimeRemaining(milestone.deadline);
            return res.status(200).json({
                status: "success",
                data: {
                    campaignOnChainId: Number(campaignOnChainId),
                    milestoneIndex: Number(milestoneIndex),
                    milestoneStatus: milestone.status,
                    retriesLeft: Math.max(0, retriesLeft - 1),
                    deadline: calculateDeadline(milestone.deadline),
                    timeRemaining: remaining,
                    reason,
                    cascadeTriggered: false,
                },
            });
        }

        milestone.status = "failed";
        milestone.failureReason = deadlineExceeded
            ? "DEADLINE_EXCEEDED_ON_REVIEW"
            : "MAX_RETRIES_EXCEEDED";
        milestone.lastRejectionReason = reason;
        milestone.lastRejectionTimestamp = new Date();
        milestone.rejectionHistory.push({
            timestamp: new Date(),
            reason,
            reviewerWallet: reviewerWallet.toLowerCase(),
        });
        await milestone.save();

        const published = await publishMilestoneFailed({
            campaignId: Number(campaignOnChainId),
            milestoneId: Number(milestoneIndex),
            markedBy: reviewerWallet.toLowerCase(),
            amount: milestone.financialTargetWei || "0",
            txHash: null,
            logIndex: -1,
            blockNumber: -1,
            reason,
        });

        const cascadeResult = published
            ? {
                queued: true,
                message:
                    "MilestoneFailed event published. Cascade will be handled by consumer.",
            }
            : await refundService.handleCampaignCascadeFailure(
                Number(campaignOnChainId),
            );

        return res.status(200).json({
            status: "success",
            data: {
                campaignOnChainId: Number(campaignOnChainId),
                milestoneIndex: Number(milestoneIndex),
                milestoneStatus: milestone.status,
                reason,
                cascadeTriggered: true,
                cascadeResult,
            },
        });
    } catch (error) {
        console.error(
            `[milestoneController.rejectMilestone] Error: ${error.message}`,
        );
        return res.status(500).json({
            status: "error",
            code: "INTERNAL_ERROR",
            message: error.message,
        });
    }
};

/**
 * PUT /api/milestones/:campaignOnChainId/:milestoneIndex/resubmit
 * Creator resubmits evidence after rejection while still in deadline.
 */
const resubmitMilestone = async (req, res) => {
    try {
        const { campaignOnChainId, milestoneIndex } = req.params;
        const creatorWallet = req.headers["x-wallet-address"];
        const evidenceCid = (
            req.body?.evidenceCid ||
            req.body?.ipfsHash ||
            ""
        ).trim();

        if (!campaignOnChainId || !milestoneIndex) {
            return res.status(400).json({
                status: "error",
                code: "INVALID_PARAMS",
                message: "campaignOnChainId and milestoneIndex required",
            });
        }

        if (!creatorWallet) {
            return res.status(403).json({
                status: "error",
                code: "PERMISSION_DENIED",
                message: "x-wallet-address header required",
            });
        }

        const campaign = await Campaign.findOne({
            onChainId: Number(campaignOnChainId),
        });
        if (!campaign) {
            return res.status(404).json({
                status: "error",
                code: "CAMPAIGN_NOT_FOUND",
                message: `Campaign ${campaignOnChainId} not found`,
            });
        }

        if (campaign.creator?.toLowerCase() !== creatorWallet.toLowerCase()) {
            return res.status(403).json({
                status: "error",
                code: "PERMISSION_DENIED",
                message: "Only campaign creator can resubmit milestone",
            });
        }

        const milestone = await Milestone.findOne({
            campaignId: campaign._id,
            milestoneIndex: Number(milestoneIndex),
        });
        if (!milestone) {
            return res.status(404).json({
                status: "error",
                code: "MILESTONE_NOT_FOUND",
                message: `Milestone ${milestoneIndex} not found`,
            });
        }

        if (milestone.status !== "resubmittable") {
            return res.status(409).json({
                status: "error",
                code: "INVALID_STATUS",
                message: `Milestone status '${milestone.status}' cannot be resubmitted`,
            });
        }

        if (isDeadlineExceeded(milestone.deadline)) {
            return res.status(409).json({
                status: "error",
                code: "DEADLINE_EXCEEDED",
                message: "Milestone deadline exceeded. Cannot resubmit.",
                deadline: calculateDeadline(milestone.deadline),
            });
        }

        if (evidenceCid) {
            milestone.evidenceCids.push(evidenceCid);
            const lastIdx = milestone.rejectionHistory.length - 1;
            if (lastIdx >= 0) {
                milestone.rejectionHistory[lastIdx].resubmittedAt = new Date();
                milestone.rejectionHistory[lastIdx].resubmittedEvidenceCid =
                    evidenceCid;
            }
        }

        milestone.status = "submitted";
        milestone.submittedAt = new Date();
        await milestone.save();

        return res.status(200).json({
            status: "success",
            data: {
                campaignOnChainId: Number(campaignOnChainId),
                milestoneIndex: Number(milestoneIndex),
                milestoneStatus: milestone.status,
                evidenceCid,
                deadline: calculateDeadline(milestone.deadline),
                timeRemaining: getTimeRemaining(milestone.deadline),
            },
        });
    } catch (error) {
        console.error(
            `[milestoneController.resubmitMilestone] Error: ${error.message}`,
        );
        return res.status(500).json({
            status: "error",
            code: "INTERNAL_ERROR",
            message: error.message,
        });
    }
};

/**
 * CRUD-style Milestone Management APIs
 * These endpoints allow off-chain management of milestones for a campaign.
 * They operate purely on MongoDB and do NOT interact with the smart contract.
 */

/**
 * POST /api/milestones/campaigns/:campaignOnChainId
 * Create a new milestone for a given on-chain campaign.
 */
const createMilestoneForCampaign = async (req, res) => {
    try {
        const { campaignOnChainId } = req.params;
        const {
            milestoneIndex,
            title,
            description = "",
            financialTargetWei,
            deadline,
            allocationBps,
        } = req.body || {};

        const callerWallet = req.headers["x-wallet-address"];
        const callerRole = req.headers["x-user-role"];

        if (!campaignOnChainId) {
            return res.status(400).json({
                status: "error",
                code: "INVALID_PARAMS",
                message: "campaignOnChainId required",
            });
        }

        if (!title || !financialTargetWei || !deadline) {
            return res.status(400).json({
                status: "error",
                code: "INVALID_BODY",
                message:
                    "title, financialTargetWei and deadline are required fields",
            });
        }

        const campaign = await Campaign.findOne({
            onChainId: Number(campaignOnChainId),
        });

        if (!campaign) {
            return res.status(404).json({
                status: "error",
                code: "CAMPAIGN_NOT_FOUND",
                message: `Campaign ${campaignOnChainId} not found`,
            });
        }

        if (
            callerRole !== "admin" &&
            (!callerWallet ||
                campaign.creator?.toLowerCase() !==
                callerWallet.toLowerCase())
        ) {
            return res.status(403).json({
                status: "error",
                code: "PERMISSION_DENIED",
                message:
                    "Only campaign creator or admin can create milestones",
            });
        }

        let indexToUse = Number(milestoneIndex);
        if (!Number.isInteger(indexToUse) || indexToUse <= 0) {
            const last = await Milestone.findOne({
                campaignOnChainId: Number(campaignOnChainId),
            })
                .sort({ milestoneIndex: -1 })
                .select("milestoneIndex");
            indexToUse = last ? Number(last.milestoneIndex) + 1 : 1;
        }

        const milestone = await Milestone.create({
            campaignId: campaign._id,
            campaignOnChainId: Number(campaignOnChainId),
            milestoneId: indexToUse,
            milestoneIndex: indexToUse,
            title,
            description,
            financialTargetWei: String(financialTargetWei),
            allocationBps: Number.isFinite(Number(allocationBps)) ? Number(allocationBps) : 0,
            deadline: new Date(deadline),
        });

        await Campaign.findByIdAndUpdate(campaign._id, {
            $addToSet: { milestoneIds: milestone._id },
        });

        return res.status(201).json({
            status: "success",
            data: milestone,
        });
    } catch (error) {
        console.error(
            `[milestoneController.createMilestoneForCampaign] Error: ${error.message}`,
        );
        return res.status(500).json({
            status: "error",
            code: "INTERNAL_ERROR",
            message: error.message,
        });
    }
};

/**
 * GET /api/milestones/campaigns/:campaignOnChainId
 * List all milestones for a campaign.
 */
const getMilestonesForCampaign = async (req, res) => {
    try {
        const { campaignOnChainId } = req.params;

        if (!campaignOnChainId) {
            return res.status(400).json({
                status: "error",
                code: "INVALID_PARAMS",
                message: "campaignOnChainId required",
            });
        }

        const campaign = await Campaign.findOne({
            onChainId: Number(campaignOnChainId),
        })
            .lean();
        if (!campaign) {
            return res.status(404).json({
                status: "error",
                code: "CAMPAIGN_NOT_FOUND",
                message: `Campaign ${campaignOnChainId} not found`,
            });
        }

        const milestones = await Milestone.find({
            campaignOnChainId: Number(campaignOnChainId),
        })
            .sort({ milestoneIndex: 1 })
            .lean();

        const totalRaised = toBigIntWei(campaign.totalRaisedWei || campaign.raised);

        const data = milestones.map((milestone) => {
            const allocationBps = Number(milestone.allocationBps || 0);
            const amountWei =
                allocationBps > 0 && totalRaised > 0n
                    ? ((totalRaised * BigInt(allocationBps)) / 10000n).toString()
                    : "0";
            return {
                ...milestone,
                amountWei,
                financialTargetWei: amountWei,
            };
        });

        return res.status(200).json({
            status: "success",
            data,
        });
    } catch (error) {
        console.error(
            `[milestoneController.getMilestonesForCampaign] Error: ${error.message}`,
        );
        return res.status(500).json({
            status: "error",
            code: "INTERNAL_ERROR",
            message: error.message,
        });
    }
};

/**
 * GET /api/milestones/campaigns/:campaignOnChainId/:milestoneIndex
 * Get a single milestone detail.
 */
const getMilestoneDetail = async (req, res) => {
    try {
        const { campaignOnChainId, milestoneIndex } = req.params;

        if (!campaignOnChainId || !milestoneIndex) {
            return res.status(400).json({
                status: "error",
                code: "INVALID_PARAMS",
                message: "campaignOnChainId and milestoneIndex required",
            });
        }

        const milestone = await Milestone.findOne({
            campaignOnChainId: Number(campaignOnChainId),
            milestoneIndex: Number(milestoneIndex),
        });

        if (!milestone) {
            return res.status(404).json({
                status: "error",
                code: "MILESTONE_NOT_FOUND",
                message: `Milestone ${milestoneIndex} not found in campaign ${campaignOnChainId}`,
            });
        }

        return res.status(200).json({
            status: "success",
            data: milestone,
        });
    } catch (error) {
        console.error(
            `[milestoneController.getMilestoneDetail] Error: ${error.message}`,
        );
        return res.status(500).json({
            status: "error",
            code: "INTERNAL_ERROR",
            message: error.message,
        });
    }
};

/**
 * PUT /api/milestones/campaigns/:campaignOnChainId/:milestoneIndex
 * Update basic fields of a milestone (title, description, financialTargetWei, deadline, status).
 */
const updateMilestone = async (req, res) => {
    try {
        const { campaignOnChainId, milestoneIndex } = req.params;
        const {
            title,
            description,
            financialTargetWei,
            deadline,
            status,
        } = req.body || {};

        const callerWallet = req.headers["x-wallet-address"];
        const callerRole = req.headers["x-user-role"];

        if (!campaignOnChainId || !milestoneIndex) {
            return res.status(400).json({
                status: "error",
                code: "INVALID_PARAMS",
                message: "campaignOnChainId and milestoneIndex required",
            });
        }

        const campaign = await Campaign.findOne({
            onChainId: Number(campaignOnChainId),
        });
        if (!campaign) {
            return res.status(404).json({
                status: "error",
                code: "CAMPAIGN_NOT_FOUND",
                message: `Campaign ${campaignOnChainId} not found`,
            });
        }

        if (
            callerRole !== "admin" &&
            (!callerWallet ||
                campaign.creator?.toLowerCase() !==
                callerWallet.toLowerCase())
        ) {
            return res.status(403).json({
                status: "error",
                code: "PERMISSION_DENIED",
                message:
                    "Only campaign creator or admin can update milestones",
            });
        }

        const updates = {};
        if (title !== undefined) updates.title = title;
        if (description !== undefined) updates.description = description;
        if (financialTargetWei !== undefined) {
            updates.financialTargetWei = String(financialTargetWei);
        }
        if (deadline !== undefined) updates.deadline = new Date(deadline);
        if (status !== undefined) updates.status = status;

        const milestone = await Milestone.findOneAndUpdate(
            {
                campaignOnChainId: Number(campaignOnChainId),
                milestoneIndex: Number(milestoneIndex),
            },
            { $set: updates },
            { new: true, runValidators: true },
        );

        if (!milestone) {
            return res.status(404).json({
                status: "error",
                code: "MILESTONE_NOT_FOUND",
                message: `Milestone ${milestoneIndex} not found in campaign ${campaignOnChainId}`,
            });
        }

        return res.status(200).json({
            status: "success",
            data: milestone,
        });
    } catch (error) {
        console.error(
            `[milestoneController.updateMilestone] Error: ${error.message}`,
        );
        return res.status(500).json({
            status: "error",
            code: "INTERNAL_ERROR",
            message: error.message,
        });
    }
};

/**
 * DELETE /api/milestones/campaigns/:campaignOnChainId/:milestoneIndex
 * Delete a milestone from a campaign.
 */
const deleteMilestone = async (req, res) => {
    try {
        const { campaignOnChainId, milestoneIndex } = req.params;
        const callerWallet = req.headers["x-wallet-address"];
        const callerRole = req.headers["x-user-role"];

        if (!campaignOnChainId || !milestoneIndex) {
            return res.status(400).json({
                status: "error",
                code: "INVALID_PARAMS",
                message: "campaignOnChainId and milestoneIndex required",
            });
        }

        const campaign = await Campaign.findOne({
            onChainId: Number(campaignOnChainId),
        });
        if (!campaign) {
            return res.status(404).json({
                status: "error",
                code: "CAMPAIGN_NOT_FOUND",
                message: `Campaign ${campaignOnChainId} not found`,
            });
        }

        if (
            callerRole !== "admin" &&
            (!callerWallet ||
                campaign.creator?.toLowerCase() !==
                callerWallet.toLowerCase())
        ) {
            return res.status(403).json({
                status: "error",
                code: "PERMISSION_DENIED",
                message:
                    "Only campaign creator or admin can delete milestones",
            });
        }

        const milestone = await Milestone.findOneAndDelete({
            campaignOnChainId: Number(campaignOnChainId),
            milestoneIndex: Number(milestoneIndex),
        });

        if (!milestone) {
            return res.status(404).json({
                status: "error",
                code: "MILESTONE_NOT_FOUND",
                message: `Milestone ${milestoneIndex} not found in campaign ${campaignOnChainId}`,
            });
        }

        await Campaign.findByIdAndUpdate(campaign._id, {
            $pull: { milestoneIds: milestone._id },
        });

        return res.status(200).json({
            status: "success",
            data: {
                deleted: true,
                milestoneId: milestone._id,
                campaignOnChainId: Number(campaignOnChainId),
                milestoneIndex: Number(milestoneIndex),
            },
        });
    } catch (error) {
        console.error(
            `[milestoneController.deleteMilestone] Error: ${error.message}`,
        );
        return res.status(500).json({
            status: "error",
            code: "INTERNAL_ERROR",
            message: error.message,
        });
    }
};

module.exports = {
    uploadProgressEvidence,
    getContributionAllocation,
    getRefundInfo,
    prepareRefund,
    getProgressReports,
    getCampaignRefundInfo,
    prepareCampaignRefund,
    rejectMilestone,
    resubmitMilestone,
    createMilestoneForCampaign,
    getMilestonesForCampaign,
    getMilestoneDetail,
    updateMilestone,
    deleteMilestone,
};
