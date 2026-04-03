const { Campaign, Milestone } = require("../models");

const BPS_DENOMINATOR = 10000;

function toBigInt(value, fieldName) {
    try {
        if (value === null || value === undefined || value === "") return 0n;
        return BigInt(value.toString());
    } catch (_error) {
        throw new Error(`Invalid bigint value for ${fieldName}: ${value}`);
    }
}

function normalizeAllocationBps(raw, goalWei, financialTargetWei) {
    const direct = Number(raw);
    if (Number.isFinite(direct)) {
        return direct;
    }

    const goal = toBigInt(goalWei, "goalWei");
    const target = toBigInt(financialTargetWei, "financialTargetWei");
    if (goal <= 0n || target <= 0n) {
        return NaN;
    }

    return Number((target * BigInt(BPS_DENOMINATOR)) / goal);
}

async function getAllCampaigns(filter = {}) {
    const query = {};
    if (filter.status) query.status = filter.status;
    if (filter.creator) query.creator = filter.creator.toLowerCase();

    return Campaign.find(query).sort({ createdAt: -1 });
}

async function getCampaignById(onChainId) {
    return Campaign.findOne({ onChainId: Number(onChainId) });
}

async function upsertCampaign(data) {
    const { onChainId, ...rest } = data;

    const normalized = {
        ...rest,
        goalWei: (rest.goalWei || rest.goal || "0").toString(),
        goal: (rest.goalWei || rest.goal || "0").toString(),
        totalRaisedWei: (rest.totalRaisedWei || rest.raised || "0").toString(),
        raised: (rest.totalRaisedWei || rest.raised || "0").toString(),
        totalDisbursedWei: (rest.totalDisbursedWei || "0").toString(),
    };

    return Campaign.findOneAndUpdate(
        { onChainId: Number(onChainId) },
        { $set: { onChainId: Number(onChainId), ...normalized } },
        { upsert: true, new: true, runValidators: true },
    );
}

async function updateCampaignStatus(onChainId, status) {
    return Campaign.findOneAndUpdate(
        { onChainId: Number(onChainId) },
        { $set: { status } },
        { new: true },
    );
}

async function updateRaised(onChainId, raisedWei) {
    return Campaign.findOneAndUpdate(
        { onChainId: Number(onChainId) },
        {
            $set: {
                totalRaisedWei: raisedWei.toString(),
                raised: raisedWei.toString(),
            },
        },
        { new: true },
    );
}

async function updateMetadata(onChainId, updates = {}) {
    const payload = { ...updates };

    if (payload.goalWei !== undefined) {
        payload.goal = payload.goalWei.toString();
    }

    if (payload.totalRaisedWei !== undefined) {
        payload.raised = payload.totalRaisedWei.toString();
    }

    return Campaign.findOneAndUpdate(
        { onChainId: Number(onChainId) },
        { $set: payload },
        { new: true, runValidators: true },
    );
}

async function createCampaignWithMilestones(payload) {
    const {
        onChainId,
        title,
        description = "",
        creator,
        beneficiary = null,
        goal,
        deadline,
        milestones = [],
    } = payload;

    const existed = await Campaign.findOne({ onChainId: Number(onChainId) });
    if (existed) {
        const err = new Error("Campaign already exists");
        err.statusCode = 409;
        throw err;
    }

    if (!beneficiary) {
        const err = new Error("beneficiary is required");
        err.statusCode = 400;
        throw err;
    }

    if (!Array.isArray(milestones)) {
        const err = new Error("milestones must be an array");
        err.statusCode = 400;
        throw err;
    }

    const normalizedGoalWei = (goal || "0").toString();
    const campaignDeadline = new Date(deadline);

    const campaign = await Campaign.create({
        onChainId: Number(onChainId),
        title,
        description,
        creator: creator.toLowerCase(),
        beneficiary: beneficiary.toLowerCase(),
        goalWei: normalizedGoalWei,
        goal: normalizedGoalWei,
        deadline: campaignDeadline,
        status: "active",
    });

    const milestoneDocs = milestones.map((m, idx) => {
        const milestoneId = Number.isFinite(Number(m?.milestoneId))
            ? Number(m.milestoneId)
            : idx;
        const allocationBps = normalizeAllocationBps(
            m?.allocationBps,
            normalizedGoalWei,
            m?.financialTargetWei,
        );

        if (
            !Number.isFinite(allocationBps) ||
            allocationBps < 0 ||
            allocationBps > BPS_DENOMINATOR
        ) {
            const err = new Error(
                `Invalid allocationBps for milestoneId=${milestoneId}. Provide allocationBps in [0, 10000].`,
            );
            err.statusCode = 400;
            throw err;
        }

        const computedTargetWei =
            m?.financialTargetWei !== undefined &&
            m?.financialTargetWei !== null
                ? String(m.financialTargetWei)
                : (
                      (toBigInt(normalizedGoalWei, "goalWei") *
                          BigInt(allocationBps)) /
                      BigInt(BPS_DENOMINATOR)
                  ).toString();

        return {
            campaignId: campaign._id,
            campaignOnChainId: Number(onChainId),
            milestoneId,
            milestoneIndex: Number.isFinite(Number(m?.milestoneIndex))
                ? Number(m.milestoneIndex)
                : milestoneId,
            allocationBps,
            title: m?.title || `Milestone ${milestoneId}`,
            description: m?.description || "",
            financialTargetWei: computedTargetWei,
            deadline: new Date(m?.deadline || campaignDeadline),
            status: "pending_funding",
        };
    });

    const totalBps = milestoneDocs.reduce(
        (sum, item) => sum + Number(item.allocationBps || 0),
        0,
    );
    if (totalBps > BPS_DENOMINATOR) {
        const err = new Error("Total milestone allocationBps must be <= 10000");
        err.statusCode = 400;
        throw err;
    }

    let createdMilestones = [];
    try {
        if (milestoneDocs.length) {
            createdMilestones = await Milestone.insertMany(milestoneDocs, {
                ordered: true,
            });

            campaign.milestoneIds = createdMilestones.map((x) => x._id);
            await campaign.save();
        }
    } catch (error) {
        await Milestone.deleteMany({
            campaignOnChainId: Number(onChainId),
            campaignId: campaign._id,
        });
        await Campaign.deleteOne({ _id: campaign._id });
        throw error;
    }

    return { campaign, milestones: createdMilestones };
}

module.exports = {
    getAllCampaigns,
    getCampaignById,
    upsertCampaign,
    updateCampaignStatus,
    updateRaised,
    updateMetadata,
    createCampaignWithMilestones,
};
