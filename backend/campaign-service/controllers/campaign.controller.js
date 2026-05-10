const axios = require("axios");
const { getAddress, ethers } = require("ethers");
const campaignService = require("../services/campaign.service");
const { Campaign, Milestone, Donation } = require("../models");
const { successRes, errorRes } = require("../utils/response");

// Approval status cache (for getMilestoneApprovalStatus)
const approvalStatusCache = new Map();
const APPROVAL_STATUS_CACHE_TTL = 15 * 1000; // 15 seconds (reduced from 2 mins for better UI responsiveness)

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
    // ApproveMilestone function signature for decoding
    {
        type: "function",
        name: "approveMilestone",
        stateMutability: "nonpayable",
        inputs: [
            { name: "_campaignId", type: "uint256" },
            { name: "_milestoneId", type: "uint256" },
        ],
        outputs: [],
    },
];

// ApproveMilestone function selector (first 4 bytes of keccak256 hash)
const APPROVE_MILESTONE_SELECTOR = "0x20913da5"; // keccak256("approveMilestone(uint256,uint256)").slice(0, 10)

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

        const pagination = {};
        if (req.query.page) pagination.page = req.query.page;
        if (req.query.limit) pagination.limit = req.query.limit;

        const { campaigns, total, page, limit } = await campaignService.getAllCampaigns(filter, pagination);

        return successRes(res, {
            campaigns,
            pagination: {
                page,
                limit,
                total,
                totalPages: limit > 0 ? Math.max(Math.ceil(total / limit), 1) : 1,
            },
        });
    } catch (err) {
        return next(err);
    }
}

async function getCampaignById(req, res, next) {
    try {
        const onChainId = Number(req.params.onChainId ?? req.params.id);
        const campaign = await campaignService.getCampaignById(onChainId);
        if (!campaign) {
            return errorRes(res, "Campaign not found", 404);
        }

        // Fetch milestones for this campaign
        const milestones = await Milestone.find({ 
            campaignOnChainId: onChainId 
        }).sort({ milestoneId: 1 }).lean();

        const responseData = {
            ...normalizeCampaignItem(campaign),
            milestones: milestones || []
        };

        return successRes(res, responseData);
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

        // Fetch milestones for this campaign
        const milestones = await Milestone.find({ 
            campaignOnChainId: onChainId 
        }).sort({ milestoneId: 1 }).lean();

        return successRes(res, {
            ...normalizeCampaignItem(campaign),
            milestones: milestones || [],
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
                    lastRejectionReason: milestone.lastRejectionReason || null,
                    rejectionCount: Number(milestone.rejectionCount || 0),
                    maxRetries: Number(milestone.maxRetries || 3),
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
    const data = tx?.data;
    if (!data || typeof data !== "string") {
        console.log(`[isMatching] No data or not string`);
        return false;
    }

    // Check if transaction matches approveMilestone function selector
    if (!data.startsWith(APPROVE_MILESTONE_SELECTOR)) {
        console.log(`[isMatching] Selector mismatch: got ${data.slice(0, 10)}, expected ${APPROVE_MILESTONE_SELECTOR}`);
        return false;
    }

    try {
        // Decode parameters from calldata manually (skip selector)
        // data format: "0x" + 8 hex chars (selector) + 64 hex chars (param1) + 64 hex chars (param2)
        const paramsHex = data.slice(10); // skip "0x" + 8 hex chars (4 bytes selector)

        // Each uint256 is 32 bytes = 64 hex chars
        const param1Hex = paramsHex.slice(0, 64);
        const param2Hex = paramsHex.slice(64, 128);

        // Convert hex to number using BigInt
        const param1 = BigInt("0x" + param1Hex);
        const param2 = BigInt("0x" + param2Hex);

        // Compare with expected values (both orders due to Safe swap)
        const match1 = param1 === BigInt(campaignOnChainId) && param2 === BigInt(milestoneId);
        const match2 = param1 === BigInt(milestoneId) && param2 === BigInt(campaignOnChainId);

        console.log(`[isMatching] campaignOnChainId=${campaignOnChainId}, milestoneId=${milestoneId}, param1=${param1.toString()}, param2=${param2.toString()}, match1=${match1}, match2=${match2}`);

        return match1 || match2;
    } catch (error) {
        console.warn(
            `[campaign.controller] Failed to decode approveMilestone data: ${error.message}`
        );
        return false;
    }
}

async function getMilestoneApprovalStatus(req, res, next) {
    try {
        const campaignOnChainId = Number(req.params.onChainId);
        const milestoneId = Number(req.params.milestoneId);

        console.log(`[getMilestoneApprovalStatus] CALLED with params:`, {
            campaignOnChainId,
            milestoneId,
            params: req.params
        });

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

        console.log(`[getMilestoneApprovalStatus] campaign.reviewerSafe:`, safeAddress);

        // Validate and get checksum address early
        let checksumSafe;
        try {
            checksumSafe = getAddress(safeAddress);
        } catch {
            return errorRes(res, "Campaign reviewerSafe is invalid", 400);
        }

        console.log(`[getMilestoneApprovalStatus] checksumSafe:`, checksumSafe);

        // Check cache (skip if refresh requested or milestone already approved in DB)
        const cacheKey = `${campaignOnChainId}-${milestoneId}`;
        const shouldRefresh = req.query.refresh === "true";
        const cached = approvalStatusCache.get(cacheKey);
        
        if (cached && !shouldRefresh && Date.now() < cached.expiresAt) {
          console.log(`[getMilestoneApprovalStatus] Cache HIT for ${cacheKey}`);
          return successRes(res, cached.data);
        }

        // FIX: Check if milestone is already approved in DB
        const milestone = await Milestone.findOne({
            campaignOnChainId,
            milestoneId
        }).lean();

        if (milestone && milestone.status === "approved") {
            console.log(`[getMilestoneApprovalStatus] Milestone already approved in DB, returning early`);

            return successRes(res, {
                safeAddress: checksumSafe,
                required: 2, // Default threshold for 2/3 multisig
                confirmed: 2, // Pretend fully confirmed
                executed: true,
                signers: [],
                pendingTxHash: "",
            });
        }

        // Use correct Safe Transaction Service API with query params to get only pending transactions
        const safeApiUrl = `https://api.safe.global/tx-service/sep/api/v1/safes/${checksumSafe}/multisig-transactions/?executed=false&ordering=-nonce`;

        console.log(`[getMilestoneApprovalStatus] Fetching from Safe API: ${safeApiUrl}`);
        console.log(`[getMilestoneApprovalStatus] Looking for campaign ${campaignOnChainId}, milestone ${milestoneId}`);

        const response = await axios.get(safeApiUrl, {
            timeout: 15_000,
        });

        console.log(`[getMilestoneApprovalStatus] Safe API response:`, {
            count: response.data?.count,
            resultsCount: Array.isArray(response.data?.results) ? response.data.results.length : 0,
        });

        const results = Array.isArray(response.data?.results)
            ? response.data.results
            : [];

        // Log first few transactions for debugging
        if (results.length > 0) {
            console.log(`[getMilestoneApprovalStatus] First transaction:`, {
                data: results[0].data?.slice(0, 20) + "...",
                method: results[0].dataDecoded?.method,
                confirmations: results[0].confirmations?.length,
            });
        }

        // Find the pending transaction matching this milestone
        const pendingTx = results.find((tx) => {
            const matches = isMatchingApproveMilestoneTx(tx, campaignOnChainId, milestoneId);
            if (matches) {
                console.log(`[getMilestoneApprovalStatus] Found matching pending transaction:`, {
                    safeTxHash: tx.safeTxHash || tx.transactionHash,
                    confirmations: tx.confirmations?.length,
                });
            }
            return matches;
        });

        // Check if transaction has been executed (query is executed=false so this shouldn't happen, but keep for safety)
        const executedTx = results.find((tx) => {
            const executed = Boolean(tx?.isExecuted ?? tx?.executed);
            return (
                executed &&
                isMatchingApproveMilestoneTx(tx, campaignOnChainId, milestoneId)
            );
        });

        console.log(`[getMilestoneApprovalStatus] pendingTx found:`, !!pendingTx, 'executedTx found:', !!executedTx);

        // If executed, update Milestone status in DB
        if (executedTx) {
            const txHash = executedTx.transactionHash || executedTx.safeTxHash || "";
            await Milestone.findOneAndUpdate(
                { campaignOnChainId, milestoneId },
                {
                    status: "approved",
                    approvedAt: new Date(),
                    approvedBy: txHash,
                    safeTxHash: txHash,
                },
                { new: true }
            ).catch((err) => {
                console.warn(
                    `[campaign.controller] Failed to update milestone ${campaignOnChainId}/${milestoneId} to approved: ${err.message}`
                );
            });

            // Invalidate cache for this milestone
            approvalStatusCache.delete(cacheKey);
        }

        if (!pendingTx) {
            console.log(`[getMilestoneApprovalStatus] No pending transaction found for this milestone`);
            const result = {
                safeAddress: checksumSafe,
                required: 0,
                confirmed: 0,
                executed: Boolean(executedTx),
                signers: [],
                pendingTxHash: executedTx?.safeTxHash || executedTx?.transactionHash || "",
            };

            // Save to cache
            approvalStatusCache.set(cacheKey, {
                data: result,
                expiresAt: Date.now() + APPROVAL_STATUS_CACHE_TTL,
            });

            return successRes(res, result);
        }

        const confirmations = Array.isArray(pendingTx.confirmations)
            ? pendingTx.confirmations
            : [];
        const signers = confirmations
            .map((item) => item?.owner)
            .filter((owner) => typeof owner === "string");

        console.log(`[getMilestoneApprovalStatus] Returning:`, {
            required: pendingTx.confirmationsRequired,
            confirmed: confirmations.length,
            signers: signers.length,
        });

        const result = {
            safeAddress: checksumSafe,
            required: Number(
                pendingTx.confirmationsRequired ||
                    pendingTx.confirmations_required ||
                    0
            ),
            confirmed: confirmations.length,
            executed: false,
            signers,
            pendingTxHash:
                pendingTx.safeTxHash || pendingTx.transactionHash || "",
        };

        // Save to cache
        approvalStatusCache.set(cacheKey, {
            data: result,
            expiresAt: Date.now() + APPROVAL_STATUS_CACHE_TTL,
        });

        return successRes(res, result);
    } catch (err) {
        if (err.response) {
            return errorRes(res, `Safe API error: ${err.response.status}`, 502);
        }

        return next(err);
    }
}

async function updateMilestoneSafeTxHash(req, res, next) {
    try {
        const campaignOnChainId = Number(req.params.onChainId);
        const milestoneId = Number(req.params.milestoneId);
        const { safeTxHash } = req.body;

        if (
            !Number.isFinite(campaignOnChainId) ||
            !Number.isFinite(milestoneId)
        ) {
            return errorRes(res, "Invalid campaign or milestone id", 400);
        }

        if (!safeTxHash || typeof safeTxHash !== "string") {
            return errorRes(res, "safeTxHash is required", 400);
        }

        const milestone = await Milestone.findOneAndUpdate(
            { campaignOnChainId, milestoneId },
            { safeTxHash: safeTxHash.trim() },
            { new: true }
        );

        if (!milestone) {
            return errorRes(res, "Milestone not found", 404);
        }

        return successRes(res, { milestone });
    } catch (err) {
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

/**
 * Invalidate cache for a specific milestone approval status
 * @param {number} campaignOnChainId
 * @param {number} milestoneId
 */
function invalidateApprovalCache(campaignOnChainId, milestoneId) {
    const cacheKey = `${campaignOnChainId}-${milestoneId}`;
    approvalStatusCache.delete(cacheKey);
    console.log(`[campaign.controller] Invalidated approval cache for ${cacheKey}`);
}

async function getRefundStatus(req, res, next) {
    try {
        const onChainId = Number(req.params.onChainId);
        const walletAddress = (req.query.address || "").toString().toLowerCase();

        if (!Number.isFinite(onChainId) || !walletAddress) {
            return errorRes(res, "Invalid campaign id or donor address", 400);
        }

        const { CampaignRefund } = require("../models");
        
        // Find any refunded record first, or fallback to the most recent record
        const refunds = await CampaignRefund.find({
            campaignOnChainId: onChainId,
            donorAddress: walletAddress,
        }).sort({ status: -1, updatedAt: -1 }).lean();

        const refund = refunds.find(r => r.status === "refunded") || refunds[0];

        // Fallback: If not marked as refunded in DB, check Blockchain directly
        let finalStatus = refund?.status || "none";
        if (finalStatus !== "refunded" && walletAddress) {
            try {
                const { createContractInstance } = require("../../listener-service/config/contract");
                const result = createContractInstance();
                if (result) {
                    const { contract } = result;
                    // Check on-chain balance
                    const onChainDonation = await contract.getDonation(BigInt(onChainId), walletAddress);
                    
                    if (onChainDonation === 0n) {
                        // If balance is 0, we need to know if they EVER donated to confirm it's a refund
                        // and not just a non-donor.
                        const { Donation } = require("../models");
                        const everDonated = await Donation.exists({
                            campaignOnChainId: onChainId,
                            donor: walletAddress,
                            status: "success"
                        });

                        if (everDonated) {
                            const campaignOnChain = await contract.getCampaign(BigInt(onChainId));
                            // Status 5 = Failed, 4 = PartialFailed
                            // Also, if the campaign is still active but they donated and now balance is 0,
                            // it's highly likely a refund happened or a state mismatch we should respect.
                            if (Number(campaignOnChain.status) >= 4 || Number(campaignOnChain.status) === 2) {
                                finalStatus = "refunded";
                            }
                        }
                    }
                }
            } catch (err) {
                console.warn("[getRefundStatus] Blockchain fallback check failed:", err.message);
            }
        }

        return successRes(res, {
            status: finalStatus,
            refundedWei: refund?.refundedWei || "0",
            eligibleRefundWei: refund?.eligibleRefundWei || "0",
            refundedAt: refund?.updatedAt || null,
        });
    } catch (err) {
        return next(err);
    }
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
    invalidateApprovalCache,
    getRefundStatus,
};
