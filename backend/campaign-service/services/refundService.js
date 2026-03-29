const mongoose = require("mongoose");
const {
    Campaign,
    Milestone,
    CampaignDonorShare,
    CampaignRefund,
} = require("../models");

/**
 * Refund Service (Campaign-Level)
 *
 * Core principles:
 * - Idempotent cascade handling
 * - Atomic DB update for campaign failed + refund records
 * - Campaign-level refund records (CampaignRefund)
 */

function sumWei(values = []) {
    return values.reduce((acc, v) => acc + BigInt(v || "0"), 0n);
}

function toNonNegative(value) {
    return value > 0n ? value : 0n;
}

async function getCampaignMath(campaignId) {
    const campaign = await Campaign.findById(campaignId);
    if (!campaign) return null;

    const milestones = await Milestone.find({ campaignId: campaign._id });
    const disbursedWei = sumWei(
        milestones
            .filter((m) => m.status === "disbursed")
            .map((m) => m.financialTargetWei),
    );

    const goalWei = BigInt(campaign.goal || "0");
    const refundPoolWei = toNonNegative(goalWei - disbursedWei);

    return {
        campaign,
        milestones,
        disbursedWei,
        goalWei,
        refundPoolWei,
    };
}

/**
 * Campaign-level refund eligibility for donor
 */
async function checkCampaignRefundEligibility(campaignId, donorAddress) {
    try {
        const donor = donorAddress.toLowerCase();

        const math = await getCampaignMath(campaignId);
        if (!math) {
            return {
                eligible: false,
                refundableWei: "0",
                alreadyRefunded: false,
                reason: "CAMPAIGN_NOT_FOUND",
                mode: "none",
                operations: [],
            };
        }

        const { campaign, disbursedWei, refundPoolWei } = math;

        const donorShare = await CampaignDonorShare.findOne({
            campaignId: campaign._id,
            donorAddress: donor,
        });

        if (!donorShare) {
            return {
                eligible: false,
                refundableWei: "0",
                alreadyRefunded: false,
                reason: "DONOR_NOT_ELIGIBLE",
                mode: "none",
                operations: [],
            };
        }

        const record = await CampaignRefund.findOne({
            campaignId: campaign._id,
            donorAddress: donor,
        });

        // If campaign has not failed and no prepared eligible record, donor is not claimable yet.
        if (campaign.status !== "failed" && !record) {
            return {
                eligible: false,
                refundableWei: "0",
                alreadyRefunded: false,
                reason: "CAMPAIGN_NOT_FAILED",
                mode: "none",
                operations: [],
            };
        }

        const totalRaisedWei =
            BigInt(campaign.raised || "0") > 0n
                ? BigInt(campaign.raised || "0")
                : BigInt(donorShare.campaignTotalRaisedWei || "0");

        const donorTotalWei = BigInt(
            donorShare.donorTotalContributionWei || "0",
        );

        const computedWei =
            totalRaisedWei > 0n
                ? (donorTotalWei * refundPoolWei) / totalRaisedWei
                : 0n;

        const eligibleWei =
            record?.eligibleRefundWei != null
                ? BigInt(record.eligibleRefundWei || "0")
                : computedWei;
        const refundedWei = BigInt(record?.refundedWei || "0");

        const netWei = toNonNegative(eligibleWei - refundedWei);
        const alreadyRefunded =
            record?.status === "refunded" ||
            (eligibleWei > 0n && netWei === 0n);

        const mode = disbursedWei === 0n ? "single" : "batch";
        const method =
            mode === "single" ? "claimFundingRefund" : "claimCampaignRefund";

        return {
            eligible: netWei > 0n,
            refundableWei: netWei.toString(),
            alreadyRefunded,
            reason: netWei > 0n ? null : "ALREADY_REFUNDED",
            mode,
            operations:
                netWei > 0n
                    ? [
                          {
                              method,
                              args: [campaign.onChainId],
                          },
                      ]
                    : [],
        };
    } catch (error) {
        console.error(
            `[refundService.checkCampaignRefundEligibility] Error for campaign=${campaignId}, donor=${donorAddress}: ${error.message}`,
        );
        throw error;
    }
}

/**
 * Prepare campaign-level refund transaction payload
 */
async function prepareCampaignRefundTx(
    campaignId,
    donorAddress,
    contractConfig = {},
) {
    try {
        const donor = donorAddress.toLowerCase();
        const campaign = await Campaign.findById(campaignId);
        if (!campaign) throw new Error("Campaign not found");

        const eligibility = await checkCampaignRefundEligibility(
            campaignId,
            donor,
        );
        if (!eligibility.eligible) {
            throw new Error(
                `Refund not eligible: ${eligibility.reason || "UNKNOWN"}`,
            );
        }

        const now = new Date();
        const prepareRequestId = `prep_campaign_${campaignId}_${donor}_${Date.now()}`;

        await CampaignRefund.updateOne(
            {
                campaignId,
                donorAddress: donor,
                status: { $in: ["eligible", "prepared"] },
            },
            {
                $set: {
                    status: "prepared",
                    preparedAt: now,
                    prepareRequestId,
                    updatedAt: now,
                },
            },
        );

        return {
            campaignId: campaignId.toString(),
            campaignOnChainId: campaign.onChainId,
            donorAddress: donor,
            refundableWei: eligibility.refundableWei,
            mode: eligibility.mode,
            operations: eligibility.operations,
            contractAddress:
                contractConfig.address ||
                process.env.CROWDFUNDING_CONTRACT_ADDRESS ||
                process.env.FUNDING_PLATFORM_CONTRACT ||
                "",
            chainId:
                contractConfig.chainId ||
                Number(process.env.CHAIN_ID || 11155111),
            prepareRequestId,
            expiresAt: new Date(Date.now() + 15 * 60 * 1000),
            preparedAt: now,
        };
    } catch (error) {
        console.error(
            `[refundService.prepareCampaignRefundTx] Error for campaign=${campaignId}, donor=${donorAddress}: ${error.message}`,
        );
        throw error;
    }
}

/**
 * Compatibility wrappers for milestone-level endpoints.
 * They delegate to campaign-level logic.
 */
async function checkRefundEligibility(campaignId, _milestoneId, donorAddress) {
    const result = await checkCampaignRefundEligibility(
        campaignId,
        donorAddress,
    );
    return {
        eligible: result.eligible,
        refundableWei: result.refundableWei,
        alreadyRefunded: result.alreadyRefunded,
        reason: result.reason,
    };
}

async function prepareRefundTx(
    campaignId,
    _milestoneId,
    donorAddress,
    contractConfig = {},
) {
    const result = await prepareCampaignRefundTx(
        campaignId,
        donorAddress,
        contractConfig,
    );

    return {
        ...result,
        method: result.operations?.[0]?.method,
        args: result.operations?.[0]?.args || [],
    };
}

/**
 * Handle cascade failure atomically.
 * - Idempotent guard: if campaign already failed => return early
 * - Atomic transaction: campaign failed + refund records upsert together
 */
async function handleCampaignCascadeFailure(campaignOnChainId) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const campaign = await Campaign.findOne({
            onChainId: Number(campaignOnChainId),
        }).session(session);

        if (!campaign) {
            throw new Error(
                `Campaign not found: onChainId=${campaignOnChainId}`,
            );
        }

        // Idempotency guard
        if (campaign.status === "failed") {
            await session.abortTransaction();
            return {
                campaignId: campaign._id,
                campaignOnChainId: Number(campaignOnChainId),
                totalDonors: 0,
                refundsCreated: 0,
                refundPoolWei: "0",
                alreadyFailed: true,
            };
        }

        const milestones = await Milestone.find({
            campaignId: campaign._id,
        }).session(session);

        const disbursedTotalWei = sumWei(
            milestones
                .filter((m) => m.status === "disbursed")
                .map((m) => m.financialTargetWei),
        );

        const campaignGoalWei = BigInt(campaign.goal || "0");
        const refundPoolWei = toNonNegative(
            campaignGoalWei - disbursedTotalWei,
        );

        const donorShares = await CampaignDonorShare.find({
            campaignId: campaign._id,
        }).session(session);

        const totalRaisedWei =
            BigInt(campaign.raised || "0") > 0n
                ? BigInt(campaign.raised || "0")
                : sumWei(donorShares.map((x) => x.donorTotalContributionWei));

        // mark campaign failed first (within transaction)
        campaign.status = "failed";
        campaign.lifecycleStatus = "failed";
        campaign.updatedAt = new Date();
        await campaign.save({ session });

        if (
            refundPoolWei === 0n ||
            totalRaisedWei === 0n ||
            donorShares.length === 0
        ) {
            await session.commitTransaction();
            return {
                campaignId: campaign._id,
                campaignOnChainId: Number(campaignOnChainId),
                totalDonors: donorShares.length,
                refundsCreated: 0,
                refundPoolWei: refundPoolWei.toString(),
            };
        }

        const operations = donorShares
            .map((share) => {
                const donorWei = BigInt(share.donorTotalContributionWei || "0");
                const eligibleRefundWei =
                    totalRaisedWei > 0n
                        ? (donorWei * refundPoolWei) / totalRaisedWei
                        : 0n;

                if (eligibleRefundWei <= 0n) return null;

                return {
                    updateOne: {
                        filter: {
                            campaignId: campaign._id,
                            donorAddress: share.donorAddress,
                        },
                        update: {
                            $setOnInsert: {
                                campaignId: campaign._id,
                                campaignOnChainId: Number(campaignOnChainId),
                                donorAddress: share.donorAddress,
                                eligibleRefundWei: eligibleRefundWei.toString(),
                                refundedWei: "0",
                                status: "eligible",
                                createdAt: new Date(),
                                updatedAt: new Date(),
                            },
                        },
                        upsert: true,
                    },
                };
            })
            .filter(Boolean);

        if (operations.length > 0) {
            await CampaignRefund.bulkWrite(operations, {
                session,
                ordered: false,
            });
        }

        await session.commitTransaction();

        return {
            campaignId: campaign._id,
            campaignOnChainId: Number(campaignOnChainId),
            totalDonors: donorShares.length,
            refundsCreated: operations.length,
            refundPoolWei: refundPoolWei.toString(),
        };
    } catch (error) {
        await session.abortTransaction();
        console.error(
            `[refundService.handleCampaignCascadeFailure] Error for campaignOnChainId=${campaignOnChainId}: ${error.message}`,
        );
        throw error;
    } finally {
        session.endSession();
    }
}

module.exports = {
    checkRefundEligibility,
    prepareRefundTx,
    checkCampaignRefundEligibility,
    prepareCampaignRefundTx,
    handleCampaignCascadeFailure,
};
