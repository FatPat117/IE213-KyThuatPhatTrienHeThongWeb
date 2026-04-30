const axios = require("axios");
const { getAddress, ethers } = require("ethers");
const campaignService = require("../services/campaign.service");
const { Campaign, Milestone, Donation } = require("../models");
const { successRes, errorRes } = require("../utils/response");

const CHAIN_READER_ABI = [
    {
        type: "function",
        name: "getCampaign",
        stateMutability: "view",
        inputs: [{ name: "campaignId", type: "uint256" }],
        outputs: [
            {
                type: "tuple",
                components: [
                    { name: "id", type: "uint256" },
                    { name: "creator", type: "address" },
                    { name: "beneficiary", type: "address" },
                    { name: "goal", type: "uint256" },
                    { name: "totalRaised", type: "uint256" },
                    { name: "totalDisbursed", type: "uint256" },
                    { name: "deadline", type: "uint256" },
                    { name: "withdrawn", type: "bool" },
                    { name: "status", type: "uint8" },
                    { name: "milestoneCount", type: "uint256" },
                    { name: "currentMilestoneId", type: "uint256" },
                ],
            },
        ],
    },
    {
        type: "function",
        name: "getMilestone",
        stateMutability: "view",
        inputs: [
            { name: "campaignId", type: "uint256" },
            { name: "milestoneId", type: "uint256" },
        ],
        outputs: [
            {
                type: "tuple",
                components: [
                    { name: "id", type: "uint256" },
                    { name: "allocationBps", type: "uint16" },
                    { name: "deadline", type: "uint256" },
                    { name: "proofIpfsCid", type: "string" },
                    { name: "status", type: "uint8" },
                    { name: "approvedBy", type: "address" },
                    { name: "approvedAt", type: "uint256" },
                    { name: "disbursedAt", type: "uint256" },
                    { name: "failedAt", type: "uint256" },
                ],
            },
        ],
    },
    {
        type: "function",
        name: "campaignReviewerSafe",
        stateMutability: "view",
        inputs: [{ name: "campaignId", type: "uint256" }],
        outputs: [{ name: "", type: "address" }],
    },
];

const STATUS_MAP = {
    0: "pending_approval",
    1: "active",
    2: "in_progress",
    3: "completed",
    4: "partial_failed",
    5: "failed",
    6: "cancelled",
};

let chainReader = null;

function getChainReader() {
    if (chainReader) return chainReader;
    const rpcUrl = process.env.SEPOLIA_RPC_URL;
    const contractAddress = process.env.CROWDFUNDING_CONTRACT_ADDRESS;
    if (!rpcUrl || !contractAddress) return null;
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    chainReader = new ethers.Contract(
        contractAddress,
        CHAIN_READER_ABI,
        provider,
    );
    return chainReader;
}

function isEvmAddress(value) {
    return /^0x[a-fA-F0-9]{40}$/.test((value || "").toString());
}

async function hydrateCampaignFromChain(onChainId) {
    const reader = getChainReader();
    if (!reader) return false;

    try {
        const rawCampaign = await reader.getCampaign(BigInt(onChainId));
        const creator = (rawCampaign?.creator || "").toString().toLowerCase();
        const beneficiary = (rawCampaign?.beneficiary || "")
            .toString()
            .toLowerCase();
        if (!isEvmAddress(creator) || !isEvmAddress(beneficiary)) {
            return false;
        }

        const goalWei = (rawCampaign?.goal || 0n).toString();
        const raisedWei = (rawCampaign?.totalRaised || 0n).toString();
        const disbursedWei = (rawCampaign?.totalDisbursed || 0n).toString();
        const milestoneCount = Number(rawCampaign?.milestoneCount || 0n);
        const currentMilestoneId = Number(rawCampaign?.currentMilestoneId || 0n);
        const deadlineSeconds = Number(rawCampaign?.deadline || 0n);
        const statusCode = Number(rawCampaign?.status ?? 1);

        const reviewerSafeRaw = await reader
            .campaignReviewerSafe(BigInt(onChainId))
            .catch(() => "");
        const reviewerSafe = isEvmAddress(reviewerSafeRaw)
            ? reviewerSafeRaw.toString().toLowerCase()
            : "";

        const campaign = await Campaign.findOneAndUpdate(
            { onChainId },
            {
                $set: {
                    creator,
                    beneficiary,
                    goalWei,
                    goal: goalWei,
                    totalRaisedWei: raisedWei,
                    raised: raisedWei,
                    totalDisbursedWei: disbursedWei,
                    deadline: new Date(deadlineSeconds * 1000),
                    milestoneCount,
                    currentMilestoneId,
                    reviewerSafe,
                    status: STATUS_MAP[statusCode] || "active",
                },
                $setOnInsert: {
                    title: "",
                    description: "",
                    thumbnailUrl: "",
                    remainingWei: "0",
                },
            },
            { upsert: true, new: true, runValidators: true },
        );

        if (!campaign || milestoneCount <= 0) return Boolean(campaign);

        const goal = toBigInt(goalWei);
        const milestoneSeeds = [];
        for (let milestoneId = 0; milestoneId < milestoneCount; milestoneId += 1) {
            const rawMilestone = await reader
                .getMilestone(BigInt(onChainId), BigInt(milestoneId))
                .catch(() => null);
            const allocationBps = Number(rawMilestone?.allocationBps || 0);
            const amountWei =
                goal > 0n && allocationBps > 0
                    ? ((goal * BigInt(allocationBps)) / 10_000n).toString()
                    : "0";
            const milestoneDeadline = Number(
                rawMilestone?.deadline || rawCampaign?.deadline || 0n,
            );

            milestoneSeeds.push({
                milestoneId,
                allocationBps,
                financialTargetWei: amountWei,
                deadline: new Date(milestoneDeadline * 1000),
            });
        }

        await Milestone.bulkWrite(
            milestoneSeeds.map((item) => ({
                updateOne: {
                    filter: {
                        campaignOnChainId: onChainId,
                        milestoneId: item.milestoneId,
                    },
                    update: {
                        $set: {
                            campaignId: campaign._id,
                            campaignOnChainId: onChainId,
                            milestoneId: item.milestoneId,
                            milestoneIndex: item.milestoneId,
                            allocationBps: item.allocationBps,
                            financialTargetWei: item.financialTargetWei,
                            deadline: item.deadline,
                        },
                        $setOnInsert: {
                            title: "",
                            description: "",
                            status: "pending_funding",
                            reportCids: [],
                            evidenceCids: [],
                        },
                    },
                    upsert: true,
                },
            })),
            { ordered: false },
        );

        return true;
    } catch (error) {
        console.warn(
            `[campaign.controller] hydrateCampaignFromChain failed for ${onChainId}: ${error.message}`,
        );
        return false;
    }
}

function toBigInt(value) {
    try {
        return BigInt((value || "0").toString());
    } catch {
        return 0n;
    }
}

function percentOf(numerator, denominator) {
    if (denominator <= 0n) {
        return 0;
    }

    const scaled = (numerator * 10_000n) / denominator;
    return Number(scaled) / 100;
}

function normalizeCampaignItem(campaignDoc) {
    return {
        onChainId: campaignDoc.onChainId,
        title: campaignDoc.title || "",
        description: campaignDoc.description || "",
        creator: campaignDoc.creator,
        reviewerSafe: campaignDoc.reviewerSafe || "",
        goalWei: campaignDoc.goalWei || campaignDoc.goal || "0",
        totalRaisedWei: campaignDoc.totalRaisedWei || campaignDoc.raised || "0",
        totalDisbursedWei: campaignDoc.totalDisbursedWei || "0",
        deadline: campaignDoc.deadline,
        status: campaignDoc.status,
        milestoneCount: campaignDoc.milestoneCount || 0,
        thumbnailUrl: campaignDoc.thumbnailUrl || "",
        createdAt: campaignDoc.createdAt,
    };
}

async function getAllCampaigns(req, res, next) {
    try {
        const filter = {};
        if (req.query.status) filter.status = req.query.status;
        if (req.query.creator) filter.creator = req.query.creator;

        const campaigns = await campaignService.getAllCampaigns(filter);
        return successRes(res, campaigns);
    } catch (err) {
        return next(err);
    }
}

async function getCampaignById(req, res, next) {
    try {
        const campaign = await campaignService.getCampaignById(
            req.params.onChainId || req.params.id,
        );
        if (!campaign) {
            return errorRes(res, "Campaign not found", 404);
        }

        return successRes(res, campaign);
    } catch (err) {
        return next(err);
    }
}

async function updateCampaignStatus(req, res, next) {
    try {
        const callerRole = (req.userRole || req.headers["x-user-role"] || "")
            .toString()
            .toLowerCase();
        if (callerRole !== "admin") {
            return errorRes(res, "Forbidden", 403);
        }

        const allowed = [
            "pending_approval",
            "active",
            "in_progress",
            "completed",
            "partial_failed",
            "failed",
            "cancelled",
        ];

        const status = (req.body?.status || "").toString().trim();
        if (!allowed.includes(status)) {
            return errorRes(
                res,
                `Invalid status. Allowed: ${allowed.join(", ")}`,
                400,
            );
        }

        const campaign = await campaignService.updateCampaignStatus(
            req.params.onChainId || req.params.id,
            status,
        );

        if (!campaign) {
            return errorRes(res, "Campaign not found", 404);
        }

        return successRes(res, campaign);
    } catch (err) {
        return next(err);
    }
}

async function updateCampaignMetadata(req, res, next) {
    try {
        const walletAddress = (
            req.walletAddress ||
            req.headers["x-wallet-address"] ||
            ""
        )
            .toString()
            .toLowerCase();
        if (!walletAddress) {
            return errorRes(res, "Authentication required", 401);
        }

        const onChainId = Number(req.params.onChainId || req.params.id);
        if (!Number.isFinite(onChainId)) {
            return errorRes(res, "Invalid campaign id", 400);
        }

        const campaign = await Campaign.findOne({ onChainId });
        if (!campaign) {
            return res.status(202).json({
                success: false,
                message: "Campaign not yet indexed, retry in 3s",
            });
        }

        const normalizedCreator = (campaign.creator || "")
            .toString()
            .toLowerCase();
        if (normalizedCreator !== walletAddress) {
            return errorRes(
                res,
                "Only campaign creator can update metadata",
                403,
            );
        }

        const updates = {};
        const { title, description, thumbnailUrl, reviewerSafe, milestones } =
            req.body || {};

        if (typeof title === "string") updates.title = title.trim();
        if (typeof description === "string")
            updates.description = description.trim();
        if (typeof thumbnailUrl === "string")
            updates.thumbnailUrl = thumbnailUrl.trim();

        if (typeof reviewerSafe === "string") {
            const normalizedSafe = reviewerSafe.trim().toLowerCase();
            if (normalizedSafe && !/^0x[a-f0-9]{40}$/.test(normalizedSafe)) {
                return errorRes(res, "Invalid reviewerSafe address", 400);
            }
            updates.reviewerSafe = normalizedSafe;
        }

        const updatedCampaign = await Campaign.findOneAndUpdate(
            { onChainId },
            { $set: updates },
            { new: true, runValidators: true },
        );

        if (Array.isArray(milestones)) {
            for (const item of milestones) {
                const milestoneId = Number(item?.milestoneId);
                if (!Number.isFinite(milestoneId)) {
                    continue;
                }

                const milestonePatch = {};
                if (typeof item.title === "string") {
                    milestonePatch.title = item.title.trim();
                }
                if (typeof item.description === "string") {
                    milestonePatch.description = item.description.trim();
                }

                if (Object.keys(milestonePatch).length === 0) {
                    continue;
                }

                await Milestone.findOneAndUpdate(
                    { campaignOnChainId: onChainId, milestoneId },
                    {
                        $set: {
                            ...milestonePatch,
                            milestoneIndex: milestoneId,
                        },
                    },
                    { new: true },
                );
            }
        }

        const updatedMilestones = await Milestone.find({
            campaignOnChainId: onChainId,
        }).sort({
            milestoneId: 1,
        });

        return successRes(res, {
            campaign: updatedCampaign,
            milestones: updatedMilestones,
        });
    } catch (err) {
        return next(err);
    }
}

async function getCampaignIndexStatus(req, res, next) {
    try {
        const onChainId = Number(req.params.onChainId);
        if (!Number.isFinite(onChainId)) {
            return errorRes(res, "Invalid campaign id", 400);
        }

        let campaign = await Campaign.findOne({ onChainId }).select("_id");
        if (!campaign) {
            await hydrateCampaignFromChain(onChainId);
            campaign = await Campaign.findOne({ onChainId }).select("_id");
        }

        return successRes(res, { indexed: Boolean(campaign) });
    } catch (err) {
        return next(err);
    }
}

async function getPublicStats(req, res, next) {
    try {
        const [
            totalCampaigns,
            activeCampaigns,
            inProgressCampaigns,
            completedCampaigns,
            partialFailedCampaigns,
            failedCampaigns,
            campaigns,
            distinctDonors,
        ] = await Promise.all([
            Campaign.countDocuments({}),
            Campaign.countDocuments({ status: "active" }),
            Campaign.countDocuments({ status: "in_progress" }),
            Campaign.countDocuments({ status: "completed" }),
            Campaign.countDocuments({ status: "partial_failed" }),
            Campaign.countDocuments({ status: "failed" }),
            Campaign.find({}).select("totalRaisedWei totalDisbursedWei").lean(),
            Donation.distinct("donorWallet"),
        ]);

        let totalRaised = 0n;
        let totalDisbursed = 0n;

        for (const campaign of campaigns) {
            totalRaised += toBigInt(campaign.totalRaisedWei);
            totalDisbursed += toBigInt(campaign.totalDisbursedWei);
        }

        return successRes(res, {
            totalCampaigns,
            activeCampaigns,
            inProgressCampaigns,
            completedCampaigns,
            partialFailedCampaigns,
            failedCampaigns,
            totalRaisedWei: totalRaised.toString(),
            totalDisbursedWei: totalDisbursed.toString(),
            uniqueDonors: distinctDonors.length,
            totalCertificates: 0,
            updatedAt: new Date().toISOString(),
        });
    } catch (err) {
        return next(err);
    }
}

async function getPublicCampaigns(req, res, next) {
    try {
        const page = Math.max(Number(req.query.page) || 1, 1);
        const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 100);
        const sortField = ["createdAt", "updatedAt", "deadline"].includes(
            req.query.sort,
        )
            ? req.query.sort
            : "createdAt";
        const order = req.query.order === "asc" ? 1 : -1;

        const query = {};
        if (req.query.status) {
            query.status = req.query.status;
        }
        if (req.query.reviewerSafe) {
            query.reviewerSafe = String(req.query.reviewerSafe)
                .trim()
                .toLowerCase();
        }

        const totalItems = await Campaign.countDocuments(query);
        const totalPages = Math.max(Math.ceil(totalItems / limit), 1);

        const campaigns = await Campaign.find(query)
            .sort({ [sortField]: order })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean();

        return successRes(res, {
            items: campaigns.map(normalizeCampaignItem),
            pagination: {
                page,
                limit,
                totalItems,
                totalPages,
            },
        });
    } catch (err) {
        return next(err);
    }
}

async function getPublicCampaignByOnChainId(req, res, next) {
    try {
        const onChainId = Number(req.params.onChainId);
        if (!Number.isFinite(onChainId)) {
            return errorRes(res, "Invalid campaign id", 400);
        }

        const campaign = await Campaign.findOne({ onChainId }).lean();
        if (!campaign) {
            return errorRes(res, "Campaign not found", 404);
        }

        const goal = toBigInt(campaign.goalWei || campaign.goal);
        const totalRaised = toBigInt(
            campaign.totalRaisedWei || campaign.raised,
        );
        const totalDisbursed = toBigInt(campaign.totalDisbursedWei);
        const remaining =
            totalRaised > totalDisbursed ? totalRaised - totalDisbursed : 0n;

        return successRes(res, {
            ...normalizeCampaignItem(campaign),
            beneficiary: campaign.beneficiary,
            progress: {
                raisedPercent: percentOf(totalRaised, goal),
                disbursedPercent: percentOf(totalDisbursed, goal),
                remainingWei: remaining.toString(),
            },
        });
    } catch (err) {
        return next(err);
    }
}

async function getPublicCampaignMilestones(req, res, next) {
    try {
        const campaignOnChainId = Number(req.params.onChainId);
        if (!Number.isFinite(campaignOnChainId)) {
            return errorRes(res, "Invalid campaign id", 400);
        }

        const campaign = await Campaign.findOne({
            onChainId: campaignOnChainId,
        }).lean();
        if (!campaign) {
            return errorRes(res, "Campaign not found", 404);
        }

        const totalRaised = toBigInt(
            campaign.totalRaisedWei || campaign.raised,
        );
        const milestones = await Milestone.find({ campaignOnChainId })
            .sort({ milestoneId: 1 })
            .lean();

        return successRes(res, {
            campaignOnChainId,
            milestones: milestones.map((milestone) => {
                const allocationBps = Number(milestone.allocationBps || 0);
                const goal = toBigInt(campaign.goalWei || campaign.goal);
                
                // LUÔN TÍNH TOÁN LẠI: Đảm bảo số tiền luôn khớp với tỷ lệ % hiển thị
                // Tránh việc dữ liệu trong DB bị sai lệch so với thực tế %
                const amountWei = ((goal * BigInt(allocationBps)) / 10_000n).toString();

                return {
                    milestoneId: milestone.milestoneId,
                    title: milestone.title || "",
                    description: milestone.description || "",
                    allocationBps,
                    amountWei,
                    deadline: milestone.deadline,
                    status: milestone.status,
                    reportCids: milestone.reportCids || [],
                    approvedAt: milestone.approvedAt,
                    approvedBy: milestone.approvedBy || "",
                    disbursedAt: milestone.disbursedAt,
                };
            }),
        });
    } catch (err) {
        return next(err);
    }
}

function extractParamValue(dataDecoded, paramName, fallbackIndex) {
    const parameters = Array.isArray(dataDecoded?.parameters)
        ? dataDecoded.parameters
        : [];

    const named = parameters.find((param) => param?.name === paramName);
    if (named && named.value !== undefined) {
        return named.value;
    }

    if (
        parameters[fallbackIndex] &&
        parameters[fallbackIndex].value !== undefined
    ) {
        return parameters[fallbackIndex].value;
    }

    return undefined;
}

function isMatchingApproveMilestoneTx(tx, campaignOnChainId, milestoneId) {
    const methodName = tx?.dataDecoded?.method;
    if (methodName !== "approveMilestone") {
        return false;
    }

    const campaignArg = extractParamValue(tx.dataDecoded, "_campaignId", 0);
    const milestoneArg = extractParamValue(tx.dataDecoded, "_milestoneId", 1);

    return (
        Number(campaignArg) === campaignOnChainId &&
        Number(milestoneArg) === milestoneId
    );
}

async function getMilestoneApprovalStatus(req, res, next) {
    try {
        const campaignOnChainId = Number(req.params.onChainId);
        const milestoneId = Number(req.params.milestoneId);

        if (
            !Number.isFinite(campaignOnChainId) ||
            !Number.isFinite(milestoneId)
        ) {
            return errorRes(res, "Invalid campaign or milestone id", 400);
        }

        const campaign = await Campaign.findOne({
            onChainId: campaignOnChainId,
        }).lean();
        if (!campaign) {
            return errorRes(res, "Campaign not found", 404);
        }

        const safeAddress = (campaign.reviewerSafe || "").trim();
        if (!safeAddress) {
            return errorRes(res, "Campaign reviewerSafe is not set", 404);
        }

        let checksumSafe;
        try {
            checksumSafe = getAddress(safeAddress);
        } catch {
            return errorRes(res, "Campaign reviewerSafe is invalid", 400);
        }

        const safeApiUrl = `https://safe-transaction-sepolia.safe.global/api/v1/safes/${checksumSafe}/multisig-transactions/`;

        const response = await axios.get(safeApiUrl, {
            timeout: 15_000,
        });

        const results = Array.isArray(response.data?.results)
            ? response.data.results
            : [];

        const pendingTx = results.find((tx) => {
            const executed = Boolean(tx?.isExecuted ?? tx?.executed);
            return (
                !executed &&
                isMatchingApproveMilestoneTx(tx, campaignOnChainId, milestoneId)
            );
        });

        if (!pendingTx) {
            return successRes(res, {
                safeAddress: checksumSafe,
                required: 0,
                confirmed: 0,
                executed: false,
                signers: [],
                pendingTxHash: "",
            });
        }

        const confirmations = Array.isArray(pendingTx.confirmations)
            ? pendingTx.confirmations
            : [];
        const signers = confirmations
            .map((item) => item?.owner)
            .filter((owner) => typeof owner === "string");

        return successRes(res, {
            safeAddress: checksumSafe,
            required: Number(
                pendingTx.confirmationsRequired ||
                    pendingTx.confirmations_required ||
                    0,
            ),
            confirmed: confirmations.length,
            executed: Boolean(pendingTx.isExecuted ?? pendingTx.executed),
            signers,
            pendingTxHash:
                pendingTx.safeTxHash || pendingTx.transactionHash || "",
        });
    } catch (err) {
        if (err.response) {
            return errorRes(res, `Safe API error: ${err.response.status}`, 502);
        }

        return next(err);
    }
}

async function createCampaignWithMilestones(req, res, next) {
    void req;
    void next;
    return errorRes(
        res,
        "Legacy campaign creation endpoint is disabled. Create campaigns on-chain and wait for campaign.created event indexing.",
        410,
    );
}

module.exports = {
    getAllCampaigns,
    getCampaignById,
    updateCampaignStatus,
    updateCampaignMetadata,
    createCampaignWithMilestones,
    getCampaignIndexStatus,
    getPublicStats,
    getPublicCampaigns,
    getPublicCampaignByOnChainId,
    getPublicCampaignMilestones,
    getMilestoneApprovalStatus,
};
