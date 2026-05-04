const mongoose = require("mongoose");
const {
    Campaign,
    Milestone,
    CampaignDonorShare,
    CampaignRefund,
} = require("../models");

const FUNDING_FAILURE_MILESTONE_SENTINEL = 2n ** 256n - 1n;

function toBigInt(value) {
    try {
        return BigInt((value || "0").toString());
    } catch {
        return 0n;
    }
}

function toNonNegative(value) {
    return value > 0n ? value : 0n;
}

function sumWei(values = []) {
    return values.reduce((acc, value) => acc + toBigInt(value), 0n);
}

function normalizeDonorAddress(value) {
    return (value || "").toString().trim().toLowerCase();
}

function parseMilestoneId(value) {
    if (value === undefined || value === null || value === "") {
        return null;
    }

    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
        return null;
    }

    return parsed;
}

async function resolveCampaign(campaignIdentifier) {
    if (!campaignIdentifier && campaignIdentifier !== 0) {
        return null;
    }

    const raw = campaignIdentifier.toString();
    let campaign = null;

    if (mongoose.Types.ObjectId.isValid(raw)) {
        campaign = await Campaign.findById(raw);
    }

    if (!campaign) {
        const onChainId = Number(raw);
        if (Number.isFinite(onChainId)) {
            campaign = await Campaign.findOne({ onChainId });
        }
    }

    return campaign;
}

async function resolveDonorShare(campaign, donorAddress) {
    const byCampaignId = await CampaignDonorShare.findOne({
        campaignId: campaign._id,
        donorAddress,
    });

    if (byCampaignId) {
        return byCampaignId;
    }

    return CampaignDonorShare.findOne({
        campaignOnChainId: campaign.onChainId,
        donorAddress,
    });
}

async function resolveRefundRecord(campaign, donorAddress, milestoneId) {
    const scoped = await CampaignRefund.findOne({
        campaignId: campaign._id,
        donorAddress,
        milestoneId,
    });

    if (scoped) {
        return scoped;
    }

    return CampaignRefund.findOne({
        campaignId: campaign._id,
        donorAddress,
    });
}

function deriveRemainingWei(campaign) {
    const persisted = toBigInt(campaign.remainingWei);
    if (persisted > 0n) {
        return persisted;
    }

    const totalRaisedWei = toBigInt(campaign.totalRaisedWei || campaign.raised);
    const totalDisbursedWei = toBigInt(campaign.totalDisbursedWei);
    return toNonNegative(totalRaisedWei - totalDisbursedWei);
}

async function buildFundingFailureRefund(campaign, donorAddress) {
    if (campaign.status !== "failed") {
        return {
            eligible: false,
            refundableWei: "0",
            alreadyRefunded: false,
            reason: "CAMPAIGN_NOT_FAILED",
            mode: "funding_failure",
            contractMethod: "claimFundingRefund",
            args: [campaign.onChainId],
            operations: [],
            milestoneId: null,
            campaign,
        };
    }

    const donorShare = await resolveDonorShare(campaign, donorAddress);
    if (!donorShare) {
        return {
            eligible: false,
            refundableWei: "0",
            alreadyRefunded: false,
            reason: "DONOR_NOT_ELIGIBLE",
            mode: "funding_failure",
            contractMethod: "claimFundingRefund",
            args: [campaign.onChainId],
            operations: [],
            milestoneId: null,
            campaign,
        };
    }

    const refundableWei = toBigInt(donorShare.donorTotalContributionWei);
    const refundRecord = await resolveRefundRecord(
        campaign,
        donorAddress,
        null,
    );
    const refundedWei = toBigInt(refundRecord?.refundedWei);

    const alreadyRefunded =
        refundRecord?.status === "refunded" ||
        (refundableWei > 0n && refundedWei >= refundableWei);

    const netRefundableWei = toNonNegative(refundableWei - refundedWei);

    return {
        eligible: netRefundableWei > 0n && !alreadyRefunded,
        refundableWei: netRefundableWei.toString(),
        alreadyRefunded,
        reason:
            netRefundableWei > 0n && !alreadyRefunded
                ? null
                : "ALREADY_REFUNDED",
        mode: "funding_failure",
        contractMethod: "claimFundingRefund",
        args: [campaign.onChainId],
        operations:
            netRefundableWei > 0n && !alreadyRefunded
                ? [{ method: "claimFundingRefund", args: [campaign.onChainId] }]
                : [],
        milestoneId: null,
        campaign,
    };
}

async function buildMilestoneFailureRefund(
    campaign,
    milestoneId,
    donorAddress,
) {
    if (campaign.status !== "partial_failed") {
        return {
            eligible: false,
            refundableWei: "0",
            alreadyRefunded: false,
            reason: "CAMPAIGN_NOT_PARTIAL_FAILED",
            mode: "milestone_failure",
            contractMethod: "claimMilestoneRefund",
            args: [campaign.onChainId, milestoneId],
            operations: [],
            milestoneId,
            campaign,
        };
    }

    const milestone = await Milestone.findOne({
        campaignOnChainId: campaign.onChainId,
        milestoneId,
    });

    if (!milestone) {
        return {
            eligible: false,
            refundableWei: "0",
            alreadyRefunded: false,
            reason: "MILESTONE_NOT_FOUND",
            mode: "milestone_failure",
            contractMethod: "claimMilestoneRefund",
            args: [campaign.onChainId, milestoneId],
            operations: [],
            milestoneId,
            campaign,
        };
    }

    if (milestone.status !== "failed") {
        return {
            eligible: false,
            refundableWei: "0",
            alreadyRefunded: false,
            reason: "MILESTONE_NOT_FAILED",
            mode: "milestone_failure",
            contractMethod: "claimMilestoneRefund",
            args: [campaign.onChainId, milestoneId],
            operations: [],
            milestoneId,
            campaign,
        };
    }

    const donorShare = await resolveDonorShare(campaign, donorAddress);
    if (!donorShare) {
        return {
            eligible: false,
            refundableWei: "0",
            alreadyRefunded: false,
            reason: "DONOR_NOT_ELIGIBLE",
            mode: "milestone_failure",
            contractMethod: "claimMilestoneRefund",
            args: [campaign.onChainId, milestoneId],
            operations: [],
            milestoneId,
            campaign,
        };
    }

    const totalRaisedWei = toBigInt(
        campaign.totalRaisedWei ||
            campaign.raised ||
            donorShare.campaignTotalRaisedWei,
    );
    const donorContributionWei = toBigInt(donorShare.donorTotalContributionWei);
    const remainingWei = deriveRemainingWei(campaign);

    let refundableWei = 0n;
    if (totalRaisedWei > 0n && donorContributionWei > 0n && remainingWei > 0n) {
        refundableWei = (donorContributionWei * remainingWei) / totalRaisedWei;
    }

    const refundRecord = await resolveRefundRecord(
        campaign,
        donorAddress,
        milestoneId,
    );
    const refundedWei = toBigInt(refundRecord?.refundedWei);

    const alreadyRefunded =
        refundRecord?.status === "refunded" ||
        (refundableWei > 0n && refundedWei >= refundableWei);

    const netRefundableWei = toNonNegative(refundableWei - refundedWei);

    return {
        eligible: netRefundableWei > 0n && !alreadyRefunded,
        refundableWei: netRefundableWei.toString(),
        alreadyRefunded,
        reason:
            netRefundableWei > 0n && !alreadyRefunded
                ? null
                : "ALREADY_REFUNDED",
        mode: "milestone_failure",
        contractMethod: "claimMilestoneRefund",
        args: [campaign.onChainId, milestoneId],
        operations:
            netRefundableWei > 0n && !alreadyRefunded
                ? [
                      {
                          method: "claimMilestoneRefund",
                          args: [campaign.onChainId, milestoneId],
                      },
                  ]
                : [],
        milestoneId,
        campaign,
    };
}

async function buildRefundEligibility(
    campaignIdentifier,
    milestoneIdentifier,
    donorAddress,
) {
    const donor = normalizeDonorAddress(donorAddress);
    if (!donor) {
        return {
            eligible: false,
            refundableWei: "0",
            alreadyRefunded: false,
            reason: "INVALID_DONOR_ADDRESS",
            mode: "none",
            contractMethod: "",
            args: [],
            operations: [],
            milestoneId: null,
            campaign: null,
        };
    }

    const campaign = await resolveCampaign(campaignIdentifier);
    if (!campaign) {
        return {
            eligible: false,
            refundableWei: "0",
            alreadyRefunded: false,
            reason: "CAMPAIGN_NOT_FOUND",
            mode: "none",
            contractMethod: "",
            args: [],
            operations: [],
            milestoneId: null,
            campaign: null,
        };
    }

    if (campaign.status === "failed") {
        return buildFundingFailureRefund(campaign, donor);
    }

    if (campaign.status === "partial_failed") {
        const milestoneId = parseMilestoneId(milestoneIdentifier);
        if (
            milestoneIdentifier !== undefined &&
            milestoneIdentifier !== null &&
            milestoneIdentifier.toString() ===
                FUNDING_FAILURE_MILESTONE_SENTINEL.toString()
        ) {
            return buildFundingFailureRefund(campaign, donor);
        }

        if (milestoneId === null) {
            return {
                eligible: false,
                refundableWei: "0",
                alreadyRefunded: false,
                reason: "MILESTONE_ID_REQUIRED",
                mode: "milestone_failure",
                contractMethod: "claimMilestoneRefund",
                args: [],
                operations: [],
                milestoneId: null,
                campaign,
            };
        }

        return buildMilestoneFailureRefund(campaign, milestoneId, donor);
    }

    return {
        eligible: false,
        refundableWei: "0",
        alreadyRefunded: false,
        reason: "CAMPAIGN_NOT_REFUNDABLE",
        mode: "none",
        contractMethod: "",
        args: [],
        operations: [],
        milestoneId: null,
        campaign,
    };
}

async function savePreparedRefundRecord({
    campaign,
    donorAddress,
    milestoneId,
    refundableWei,
}) {
    const now = new Date();
    const prepareRequestId = `prep_${campaign.onChainId}_${donorAddress}_${Date.now()}`;

    await CampaignRefund.findOneAndUpdate(
        {
            campaignId: campaign._id,
            donorAddress,
        },
        {
            $set: {
                campaignOnChainId: campaign.onChainId,
                milestoneId,
                donorAddress,
                eligibleRefundWei: refundableWei,
                amountWei: refundableWei,
                status: "prepared",
                preparedAt: now,
                prepareRequestId,
                updatedAt: now,
            },
            $setOnInsert: {
                campaignId: campaign._id,
                refundedWei: "0",
                createdAt: now,
            },
        },
        {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true,
        },
    );

    return {
        prepareRequestId,
        preparedAt: now,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    };
}

function buildPreparedPayload(
    eligibility,
    donorAddress,
    contractConfig,
    preparedMeta,
) {
    return {
        campaignId: eligibility.campaign._id.toString(),
        campaignOnChainId: eligibility.campaign.onChainId,
        donorAddress,
        refundableWei: eligibility.refundableWei,
        mode: eligibility.mode,
        contractMethod: eligibility.contractMethod,
        method: eligibility.contractMethod,
        args: eligibility.args,
        operations:
            eligibility.contractMethod && eligibility.args.length
                ? [
                      {
                          method: eligibility.contractMethod,
                          args: eligibility.args,
                      },
                  ]
                : [],
        contractAddress:
            contractConfig.address ||
            process.env.CROWDFUNDING_CONTRACT_ADDRESS ||
            process.env.FUNDING_PLATFORM_CONTRACT ||
            "",
        chainId:
            contractConfig.chainId || Number(process.env.CHAIN_ID || 11155111),
        ...preparedMeta,
    };
}

async function checkRefundEligibility(campaignId, milestoneId, donorAddress) {
    const result = await buildRefundEligibility(
        campaignId,
        milestoneId,
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
    milestoneId,
    donorAddress,
    contractConfig = {},
) {
    const donor = normalizeDonorAddress(donorAddress);
    const eligibility = await buildRefundEligibility(
        campaignId,
        milestoneId,
        donor,
    );

    if (!eligibility.campaign) {
        throw new Error("Campaign not found");
    }

    if (!eligibility.eligible) {
        throw new Error(
            `Refund not eligible: ${eligibility.reason || "UNKNOWN"}`,
        );
    }

    const preparedMeta = await savePreparedRefundRecord({
        campaign: eligibility.campaign,
        donorAddress: donor,
        milestoneId: eligibility.milestoneId,
        refundableWei: eligibility.refundableWei,
    });

    return buildPreparedPayload(
        eligibility,
        donor,
        contractConfig,
        preparedMeta,
    );
}

async function checkCampaignRefundEligibility(campaignId, donorAddress) {
    const result = await buildRefundEligibility(campaignId, null, donorAddress);

    return {
        eligible: result.eligible,
        refundableWei: result.refundableWei,
        alreadyRefunded: result.alreadyRefunded,
        reason: result.reason,
        mode: result.mode,
        operations: result.operations,
    };
}

async function prepareCampaignRefundTx(
    campaignId,
    donorAddress,
    contractConfig = {},
) {
    const donor = normalizeDonorAddress(donorAddress);
    const eligibility = await buildRefundEligibility(campaignId, null, donor);

    if (!eligibility.campaign) {
        throw new Error("Campaign not found");
    }

    if (!eligibility.eligible) {
        throw new Error(
            `Refund not eligible: ${eligibility.reason || "UNKNOWN"}`,
        );
    }

    const preparedMeta = await savePreparedRefundRecord({
        campaign: eligibility.campaign,
        donorAddress: donor,
        milestoneId: null,
        refundableWei: eligibility.refundableWei,
    });

    return buildPreparedPayload(
        eligibility,
        donor,
        contractConfig,
        preparedMeta,
    );
}

async function handleCampaignCascadeFailure(campaignOnChainId) {
    try {
        console.log(`[refundService.handleCampaignCascadeFailure] Starting for campaignOnChainId=${campaignOnChainId}`);
        const campaign = await Campaign.findOne({
            onChainId: Number(campaignOnChainId),
        });

        if (!campaign) {
            console.error(`[refundService.handleCampaignCascadeFailure] Campaign not found: onChainId=${campaignOnChainId}`);
            throw new Error(
                `Campaign not found: onChainId=${campaignOnChainId}`,
            );
        }

        console.log(`[refundService.handleCampaignCascadeFailure] Found campaign: ${campaign._id}, current status: ${campaign.status}`);

        // If already in a terminal failed state, skip to avoid redundant processing
        if (campaign.status === "failed" || campaign.status === "partial_failed") {
            console.log(`[refundService.handleCampaignCascadeFailure] Campaign is already ${campaign.status}. Skipping.`);
            return {
                campaignId: campaign._id,
                campaignOnChainId: Number(campaignOnChainId),
                totalDonors: 0,
                refundsCreated: 0,
                refundPoolWei: campaign.remainingWei || "0",
                alreadyStopped: true,
            };
        }

        const milestones = await Milestone.find({
            campaignId: campaign._id,
        });
        const donorShares = await CampaignDonorShare.find({
            campaignId: campaign._id,
        });

        console.log(`[refundService.handleCampaignCascadeFailure] Found ${milestones.length} milestones and ${donorShares.length} donor shares`);

        const totalRaisedWei = toBigInt(
            campaign.totalRaisedWei || campaign.raised,
        );
        
        // Determine failure type: Funding failure if status was 'active' and raised < goal
        const isFundingFailure = campaign.status === "active" && totalRaisedWei < toBigInt(campaign.goalWei);

        const disbursedFromMilestones = sumWei(
            milestones
                .filter((milestone) => milestone.status === "disbursed")
                .map((milestone) => milestone.financialTargetWei),
        );
        const totalDisbursedWei =
            disbursedFromMilestones > 0n
                ? disbursedFromMilestones
                : toBigInt(campaign.totalDisbursedWei);

        const remainingWei = toNonNegative(totalRaisedWei - totalDisbursedWei);
        console.log(`[refundService.handleCampaignCascadeFailure] totalRaised=${totalRaisedWei}, totalDisbursed=${totalDisbursedWei}, remaining=${remainingWei}, isFundingFailure=${isFundingFailure}`);

        // Set correct status
        campaign.status = isFundingFailure ? "failed" : "partial_failed";
        campaign.remainingWei = remainingWei.toString();
        campaign.updatedAt = new Date();
        await campaign.save();
        console.log(`[refundService.handleCampaignCascadeFailure] Campaign status updated to ${campaign.status}.`);

        if (
            remainingWei === 0n ||
            totalRaisedWei === 0n ||
            donorShares.length === 0
        ) {
            return {
                campaignId: campaign._id,
                campaignOnChainId: Number(campaignOnChainId),
                totalDonors: donorShares.length,
                refundsCreated: 0,
                refundPoolWei: remainingWei.toString(),
            };
        }

        // Determine which milestone ID to associate with the refund (null for funding failure)
        let fallbackMilestoneId = null;
        if (!isFundingFailure) {
            const failedMilestone = milestones
                .filter((milestone) =>
                    ["failed", "deadline_exceeded", "review_timeout"].includes(
                        milestone.status,
                    ),
                )
                .sort(
                    (left, right) =>
                        Number(right.milestoneId || 0) -
                        Number(left.milestoneId || 0),
                )[0];

            fallbackMilestoneId = failedMilestone
                ? Number(failedMilestone.milestoneId)
                : Number(campaign.currentMilestoneId || 0);
        }

        const operations = donorShares
            .map((share) => {
                const donorTotalWei = toBigInt(share.donorTotalContributionWei);
                const eligibleRefundWei =
                    totalRaisedWei > 0n
                        ? (donorTotalWei * remainingWei) / totalRaisedWei
                        : 0n;

                if (eligibleRefundWei <= 0n) {
                    return null;
                }

                return {
                    updateOne: {
                        filter: {
                            campaignId: campaign._id,
                            donorAddress: share.donorAddress,
                            milestoneId: fallbackMilestoneId, // Include milestoneId in filter to match or create specific record
                        },
                        update: {
                            $set: {
                                campaignOnChainId: Number(campaignOnChainId),
                                milestoneId: fallbackMilestoneId,
                                eligibleRefundWei: eligibleRefundWei.toString(),
                                amountWei: eligibleRefundWei.toString(),
                                status: "eligible",
                                updatedAt: new Date(),
                            },
                            $setOnInsert: {
                                campaignId: campaign._id,
                                donorAddress: share.donorAddress,
                                refundedWei: "0",
                                createdAt: new Date(),
                            },
                        },
                        upsert: true,
                    },
                };
            })
            .filter(Boolean);

        if (operations.length > 0) {
            await CampaignRefund.bulkWrite(operations, {
                ordered: false,
            });
        }

        return {
            campaignId: campaign._id,
            campaignOnChainId: Number(campaignOnChainId),
            totalDonors: donorShares.length,
            refundsCreated: operations.length,
            refundPoolWei: remainingWei.toString(),
        };
    } catch (error) {
        console.error(
            `[refundService.handleCampaignCascadeFailure] Error for campaignOnChainId=${campaignOnChainId}: ${error.message}`,
        );
        throw error;
    }
}

module.exports = {
    checkRefundEligibility,
    prepareRefundTx,
    checkCampaignRefundEligibility,
    prepareCampaignRefundTx,
    handleCampaignCascadeFailure,
};
