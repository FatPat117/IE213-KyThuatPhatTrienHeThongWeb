const { getChannel, EXCHANGE } = require("../config/rabbitmq");
const { ethers } = require("ethers");
const { Milestone, Campaign } = require("../models");
const notificationService = require("../services/notification.service");

const QUEUE = process.env.RABBITMQ_QUEUE_CAMP_CREATED || "campaign.created.queue";
const ROUTING_KEY = process.env.RABBITMQ_RKEY_CAMP_CREATED || "campaign.created";

const MILESTONE_READER_ABI = [
    {
        type: "function",
        name: "campaignReviewerSafe",
        stateMutability: "view",
        inputs: [{ name: "campaignId", type: "uint256" }],
        outputs: [{ name: "", type: "address" }],
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
                name: "",
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
];

let milestoneReader = null;

function resolveAdminWalletsFromEnv() {
    const combined = [
        process.env.ADMIN_WALLETS || "",
        process.env.INITIAL_ADMIN_WALLET || "",
    ]
        .join(",")
        .split(/[,\s;]+/)
        .map((item) => item.trim().toLowerCase())
        .filter((item) => /^0x[a-f0-9]{40}$/.test(item));

    return [...new Set(combined)];
}

function normalizeWallet(value) {
    const wallet = (value || "").toString().trim().toLowerCase();
    return /^0x[a-f0-9]{40}$/.test(wallet) ? wallet : "";
}

async function loadAdminWalletsFromUserService() {
    const userServiceUrl =
        process.env.USER_SERVICE_URL || "http://user-service:4001";
    const requesterWallet = normalizeWallet(
        process.env.INITIAL_ADMIN_WALLET ||
            process.env.DEFAULT_ADMIN_WALLET ||
            "",
    );

    if (!requesterWallet) {
        return [];
    }

    try {
        const response = await fetch(
            `${userServiceUrl}/api/users/admin/list-admins`,
            {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                    "x-user-role": "admin",
                    "x-wallet-address": requesterWallet,
                },
            },
        );

        if (!response.ok) {
            return [];
        }

        const payload = await response.json();
        const admins = Array.isArray(payload?.data) ? payload.data : [];
        return admins
            .map((item) => normalizeWallet(item?.walletAddress || item?.wallet))
            .filter(Boolean);
    } catch {
        return [];
    }
}

async function resolveAdminWallets() {
    const envWallets = resolveAdminWalletsFromEnv();
    if (envWallets.length > 0) {
        return envWallets;
    }

    const userServiceWallets = await loadAdminWalletsFromUserService();
    return [...new Set(userServiceWallets)];
}

function getMilestoneReader() {
    if (milestoneReader) {
        return milestoneReader;
    }

    const rpcUrl = process.env.SEPOLIA_RPC_URL;
    const contractAddress = process.env.CROWDFUNDING_CONTRACT_ADDRESS;

    if (!rpcUrl || !contractAddress) {
        return null;
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    milestoneReader = new ethers.Contract(
        contractAddress,
        MILESTONE_READER_ABI,
        provider,
    );

    return milestoneReader;
}

async function loadReviewerSafe(onChainId) {
    const reader = getMilestoneReader();
    if (!reader) return "";

    try {
        const safe = await reader.campaignReviewerSafe(BigInt(onChainId));
        return (safe || "").toString().toLowerCase();
    } catch (error) {
        console.warn(
            `[campaign-service] Unable to read reviewerSafe for campaign=${onChainId}: ${error.message}`,
        );
        return "";
    }
}

async function loadMilestoneSeedData(
    onChainId,
    milestoneCount,
    fallbackDeadline,
    goalWei,
) {
    const reader = getMilestoneReader();
    const fallbackDate = new Date(Number(fallbackDeadline) * 1000);
    const results = [];
    const goal = (() => {
        try {
            return BigInt(goalWei || "0");
        } catch {
            return 0n;
        }
    })();

    for (let milestoneId = 0; milestoneId < milestoneCount; milestoneId += 1) {
        let allocationBps = 0;
        let financialTargetWei = "0";
        let deadline = fallbackDate;

        if (reader) {
            try {
                const rawMilestone = await reader.getMilestone(
                    BigInt(onChainId),
                    BigInt(milestoneId),
                );
                allocationBps = Number(rawMilestone.allocationBps || 0);
                if (goal > 0n && allocationBps > 0) {
                    financialTargetWei = ((goal * BigInt(allocationBps)) / 10_000n).toString();
                }
                deadline = new Date(Number(rawMilestone.deadline || fallbackDeadline) * 1000);
            } catch (error) {
                console.warn(
                    `[campaign-service] Unable to read on-chain milestone ${milestoneId} for campaign=${onChainId}: ${error.message}`,
                );
            }
        }

        results.push({
            milestoneId,
            allocationBps,
            financialTargetWei,
            deadline,
        });
    }

    return results;
}

async function startCampaignCreatedConsumer() {
    const channel = getChannel();
    if (!channel) {
        console.warn("[campaign-service] RabbitMQ channel unavailable. Skip consumer");
        return;
    }

    await channel.assertQueue(QUEUE, { durable: true });
    await channel.bindQueue(QUEUE, EXCHANGE, ROUTING_KEY);
    channel.prefetch(1);

    console.log(`[campaign-service] Listening for campaign.created on queue: ${QUEUE}`);

    channel.consume(QUEUE, async (msg) => {
        if (!msg) return;

        try {
            const payload = JSON.parse(msg.content.toString());
            const onChainId = Number(payload.onChainId);
            const milestoneCount = Number(payload.milestoneCount || 0);
            const reviewerSafe = await loadReviewerSafe(onChainId);

            const campaign = await Campaign.findOneAndUpdate(
                { onChainId },
                {
                    $set: {
                        creator: payload.creator.toLowerCase(),
                        beneficiary: payload.beneficiary.toLowerCase(),
                        goalWei: (payload.goalWei || "0").toString(),
                        goal: (payload.goalWei || "0").toString(),
                        deadline: new Date(Number(payload.deadline) * 1000),
                        milestoneCount,
                        reviewerSafe: reviewerSafe || "",
                    },
                    $setOnInsert: {
                        status: "pending_approval",
                        title: "",
                        description: "",
                        thumbnailUrl: "",
                        currentMilestoneId: 0,
                        totalRaisedWei: "0",
                        raised: "0",
                        totalDisbursedWei: "0",
                        remainingWei: "0",
                    },
                },
                {
                    upsert: true,
                    new: true,
                    runValidators: true,
                },
            );

            if (!campaign) {
                throw new Error(`Campaign upsert failed for onChainId=${onChainId}`);
            }

            const milestoneSeeds = await loadMilestoneSeedData(
                onChainId,
                milestoneCount,
                payload.deadline,
                payload.goalWei,
            );

            if (milestoneSeeds.length > 0) {
                await Milestone.bulkWrite(
                    milestoneSeeds.map((milestone) => ({
                        updateOne: {
                            filter: {
                                campaignOnChainId: onChainId,
                                milestoneId: milestone.milestoneId,
                            },
                            update: {
                                $set: {
                                    campaignId: campaign._id,
                                    campaignOnChainId: onChainId,
                                    milestoneId: milestone.milestoneId,
                                    milestoneIndex: milestone.milestoneId,
                                    allocationBps: milestone.allocationBps,
                                    deadline: milestone.deadline,
                                    financialTargetWei:
                                        milestone.financialTargetWei || "0",
                                },
                                $setOnInsert: {
                                    status: "pending_funding",
                                    title: "",
                                    description: "",
                                    reportCids: [],
                                    evidenceCids: [],
                                },
                            },
                            upsert: true,
                        },
                    })),
                    { ordered: false },
                );
            }

            const adminWallets = await resolveAdminWallets();
            if (adminWallets.length === 0) {
                console.warn(
                    "[campaign-service] campaign.created received but no admin wallet found from env/user-service",
                );
            } else {
                await Promise.all(
                    adminWallets.map((adminWallet) =>
                        notificationService.createNotification({
                            recipientWallet: adminWallet,
                            type: "campaign_created",
                            title: "Co campaign moi can duyet",
                            message:
                                "Mot campaign moi vua duoc tao va dang cho duyet.",
                            campaignOnChainId: onChainId,
                            txHash: payload.txHash || "",
                        }),
                    ),
                );
            }

            channel.ack(msg);
        } catch (err) {
            console.error("[campaign-service] Consumer error:", err.message);
            channel.nack(msg, false, false);
        }
    });
}

module.exports = { startCampaignCreatedConsumer };
