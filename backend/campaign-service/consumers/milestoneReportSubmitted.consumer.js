const { getChannel, EXCHANGE } = require("../config/rabbitmq");
const { Milestone } = require("../models");
const { Campaign } = require("../models");
const { ethers } = require("ethers");
const { recordTransaction } = require("../utils/recordTransaction");
const notificationService = require("../services/notification.service");

const QUEUE =
    process.env.RABBITMQ_QUEUE_MILESTONE_REPORT_SUBMITTED ||
    "milestone.report.submitted.queue";
const ROUTING_KEY =
    process.env.RABBITMQ_RKEY_MILESTONE_REPORT_SUBMITTED ||
    "milestone.report.submitted";

const REVIEWER_SAFE_ABI = [
    {
        type: "function",
        name: "campaignReviewerSafe",
        stateMutability: "view",
        inputs: [{ name: "campaignId", type: "uint256" }],
        outputs: [{ name: "", type: "address" }],
    },
];

let reviewerSafeReader = null;

function normalizeWallet(value) {
    const wallet = (value || "").toString().trim().toLowerCase();
    return /^0x[a-f0-9]{40}$/.test(wallet) ? wallet : "";
}

function getReviewerSafeReader() {
    if (reviewerSafeReader) return reviewerSafeReader;

    const rpcUrl = process.env.SEPOLIA_RPC_URL;
    const contractAddress = process.env.CROWDFUNDING_CONTRACT_ADDRESS;

    if (!rpcUrl || !contractAddress) return null;

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    reviewerSafeReader = new ethers.Contract(
        contractAddress,
        REVIEWER_SAFE_ABI,
        provider,
    );

    return reviewerSafeReader;
}

async function loadReviewerSafe(onChainId) {
    const reader = getReviewerSafeReader();
    if (!reader) return "";

    try {
        const safe = await reader.campaignReviewerSafe(BigInt(onChainId));
        return normalizeWallet(safe);
    } catch {
        return "";
    }
}

async function startMilestoneReportSubmittedConsumer() {
    const channel = getChannel();
    if (!channel) {
        console.warn(
            "[campaign-service] RabbitMQ channel unavailable. Skip milestone.report.submitted consumer",
        );
        return;
    }

    await channel.assertQueue(QUEUE, { durable: true });
    await channel.bindQueue(QUEUE, EXCHANGE, ROUTING_KEY);
    channel.prefetch(1);

    console.log(
        `[campaign-service] Listening for ${ROUTING_KEY} on queue: ${QUEUE}`,
    );

    channel.consume(QUEUE, async (msg) => {
        if (!msg) return;

        try {
            const payload = JSON.parse(msg.content.toString());
            const campaignOnChainId = Number(
                payload.campaignId || payload.campaignOnChainId,
            );
            const milestoneId = Number(payload.milestoneId);

            if (!campaignOnChainId || Number.isNaN(milestoneId)) {
                throw new Error(
                    "Missing campaignId/milestoneId in milestone.report.submitted payload",
                );
            }

            const cid = (payload.cid || payload.ipfsCid || "").toString();
            const submittedAt = new Date();

            const update = {
                $set: {
                    status: "pending_verification",
                },
            };

            if (cid) {
                update.$push = { reportCids: { cid, submittedAt } };
                update.$addToSet = { evidenceCids: cid };
            }

            await Milestone.updateOne(
                { campaignOnChainId, milestoneId },
                update,
            );
            const campaign = await Campaign.findOne({ onChainId: campaignOnChainId });
            let reviewerSafe = normalizeWallet(campaign?.reviewerSafe);
            if (!reviewerSafe) {
                reviewerSafe = await loadReviewerSafe(campaignOnChainId);
                if (reviewerSafe && campaign) {
                    campaign.reviewerSafe = reviewerSafe;
                    await campaign.save();
                }
            }
            if (reviewerSafe) {
                await notificationService.createNotification({
                    recipientWallet: reviewerSafe,
                    type: "milestone_report_submitted",
                    title: "Có bằng chứng mới cần xét duyệt",
                    message: "Creator vừa nộp minh chứng mới cho milestone.",
                    campaignOnChainId,
                    txHash: payload.txHash || "",
                });
            }

            await recordTransaction({
                txHash: payload.txHash,
                walletAddress: payload.submittedBy,
                action: "submitReport",
                campaignOnChainId,
            });

            channel.ack(msg);
        } catch (error) {
            console.error(
                "[campaign-service] milestoneReportSubmitted consumer error:",
                error.message,
            );
            channel.nack(msg, false, false);
        }
    });
}

module.exports = { startMilestoneReportSubmittedConsumer };
