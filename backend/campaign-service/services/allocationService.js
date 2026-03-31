const { CampaignDonorShare, CampaignRefund } = require("../models");

const BPS_DENOMINATOR = 10000n;

function toBigInt(value, fieldName) {
    try {
        if (value === null || value === undefined || value === "") return 0n;
        return BigInt(value);
    } catch (_error) {
        throw new Error(`Invalid bigint value for ${fieldName}: ${value}`);
    }
}

function normalizeDonorSnapshots(donationSnapshots = []) {
    const totalsByDonor = new Map();

    for (const row of donationSnapshots) {
        const donorAddress = String(
            row?.walletAddress || row?.donorWallet || row?.donorAddress || "",
        ).toLowerCase();
        if (!/^0x[a-f0-9]{40}$/.test(donorAddress)) continue;

        const amountWei = toBigInt(
            row?.totalWei ?? row?.amountWei ?? row?.amount ?? "0",
            "donationSnapshots.amount",
        );
        if (amountWei <= 0n) continue;

        totalsByDonor.set(
            donorAddress,
            (totalsByDonor.get(donorAddress) || 0n) + amountWei,
        );
    }

    return Array.from(totalsByDonor.entries()).map(([donorAddress, totalWei]) => ({
        donorAddress,
        totalWei,
    }));
}

function computeRefundPoolWei(campaign, milestones) {
    const goalWei = toBigInt(campaign?.goal || "0", "campaign.goal");

    const disbursedWei = (milestones || [])
        .filter((m) => m?.status === "disbursed")
        .reduce(
            (sum, m) =>
                sum + toBigInt(m?.financialTargetWei || "0", "milestone.financialTargetWei"),
            0n,
        );

    const refundPoolWei = goalWei > disbursedWei ? goalWei - disbursedWei : 0n;
    return { goalWei, disbursedWei, refundPoolWei };
}

async function computeAllocationAndSeedRefunds(campaign, milestones, donationSnapshots) {
    if (!campaign?._id || !Array.isArray(milestones) || !Array.isArray(donationSnapshots)) {
        throw new Error("Invalid input for allocation computation");
    }

    const donors = normalizeDonorSnapshots(donationSnapshots);
    const totalRaisedFromSnapshots = donors.reduce((sum, x) => sum + x.totalWei, 0n);
    const totalRaisedFromCampaign = toBigInt(campaign?.raised || "0", "campaign.raised");
    const campaignTotalRaisedWei =
        totalRaisedFromCampaign > 0n ? totalRaisedFromCampaign : totalRaisedFromSnapshots;

    const { goalWei, disbursedWei, refundPoolWei } = computeRefundPoolWei(campaign, milestones);
    const computedAt = new Date();

    const campaignDonorShares = donors.map((d) => {
        const donorShareInCampaignBps =
            campaignTotalRaisedWei > 0n
                ? Number((d.totalWei * BPS_DENOMINATOR) / campaignTotalRaisedWei)
                : 0;

        const eligibleRefundWei =
            campaignTotalRaisedWei > 0n
                ? (d.totalWei * refundPoolWei) / campaignTotalRaisedWei
                : 0n;

        return {
            campaignId: campaign._id,
            campaignOnChainId: Number(campaign.onChainId),
            donorAddress: d.donorAddress,
            donorTotalContributionWei: d.totalWei.toString(),
            campaignTotalRaisedWei: campaignTotalRaisedWei.toString(),
            donorShareInCampaignBps,
            eligibleRefundWei: eligibleRefundWei.toString(),
            computedAt,
        };
    });

    const summary = {
        donorCount: campaignDonorShares.length,
        milestoneCount: milestones.length,
        totalCampaignRaisedWei: campaignTotalRaisedWei.toString(),
        goalWei: goalWei.toString(),
        disbursedWei: disbursedWei.toString(),
        refundPoolWei: refundPoolWei.toString(),
    };

    return { campaignDonorShares, summary };
}

async function persistAllocations(campaignDonorShares) {
    if (!Array.isArray(campaignDonorShares) || campaignDonorShares.length === 0) {
        return { insertedShareCount: 0, insertedRefundCount: 0 };
    }

    const campaignId = campaignDonorShares[0].campaignId;
    const existingRefunds = await CampaignRefund.find({ campaignId }).select(
        "donorAddress status refundedWei",
    );
    const refundMap = new Map(
        existingRefunds.map((x) => [x.donorAddress.toLowerCase(), x]),
    );

    const now = new Date();

    const shareOps = campaignDonorShares.map((share) => ({
        updateOne: {
            filter: {
                campaignId: share.campaignId,
                donorAddress: share.donorAddress,
            },
            update: {
                $set: {
                    campaignOnChainId: share.campaignOnChainId,
                    donorTotalContributionWei: share.donorTotalContributionWei,
                    campaignTotalRaisedWei: share.campaignTotalRaisedWei,
                    donorShareInCampaignBps: share.donorShareInCampaignBps,
                    computedAt: share.computedAt,
                    updatedAt: now,
                },
                $setOnInsert: { createdAt: now },
            },
            upsert: true,
        },
    }));

    const refundOps = campaignDonorShares.map((share) => {
        const existing = refundMap.get(share.donorAddress);
        const eligibleRefundWei = share.eligibleRefundWei;
        const refundedWei = existing?.refundedWei || "0";
        const stillRefundable =
            toBigInt(eligibleRefundWei, "eligibleRefundWei") >
            toBigInt(refundedWei, "refundedWei");

        const nextStatus =
            existing?.status === "refunded"
                ? "refunded"
                : stillRefundable
                  ? "eligible"
                  : "refunded";

        return {
            updateOne: {
                filter: {
                    campaignId: share.campaignId,
                    donorAddress: share.donorAddress,
                },
                update: {
                    $set: {
                        campaignOnChainId: share.campaignOnChainId,
                        eligibleRefundWei,
                        status: nextStatus,
                        updatedAt: now,
                    },
                    $setOnInsert: {
                        refundedWei: "0",
                        refundEventId: `seed_${share.campaignOnChainId}_${share.donorAddress}`,
                        createdAt: now,
                    },
                },
                upsert: true,
            },
        };
    });

    const [shareResult, refundResult] = await Promise.all([
        CampaignDonorShare.bulkWrite(shareOps, { ordered: false }),
        CampaignRefund.bulkWrite(refundOps, { ordered: false }),
    ]);

    const insertedShareCount =
        Number(shareResult?.upsertedCount || 0) + Number(shareResult?.modifiedCount || 0);
    const insertedRefundCount =
        Number(refundResult?.upsertedCount || 0) + Number(refundResult?.modifiedCount || 0);

    return { insertedShareCount, insertedRefundCount };
}

module.exports = { computeAllocationAndSeedRefunds, persistAllocations };
