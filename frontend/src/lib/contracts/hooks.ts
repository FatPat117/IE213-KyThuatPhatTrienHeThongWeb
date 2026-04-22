"use client";

import { useMemo } from "react";
import { Address, formatEther, parseEther } from "viem";
import {
    useAccount,
    usePublicClient,
    useReadContract,
    useReadContracts,
    useWriteContract,
} from "wagmi";
import { CROWDFUNDING_CONTRACT_ADDRESS, contractConfig } from "./config";

type CampaignTuple = {
    id: bigint;
    creator: Address;
    beneficiary: Address;
    goal: bigint;
    totalRaised: bigint;
    totalDisbursed: bigint;
    deadline: bigint;
    withdrawn: boolean;
    status: number;
    milestoneCount: bigint;
    currentMilestoneId: bigint;
};

export type CampaignStatusLabel =
    | "pending_approval"
    | "active"
    | "in_progress"
    | "completed"
    | "partial_failed"
    | "failed"
    | "cancelled";

const ZERO = BigInt(0);
const PENDING_APPROVAL_STATUS = 0;
const ACTIVE_STATUS = 1;
const IN_PROGRESS_STATUS = 2;
const COMPLETED_STATUS = 3;
const PARTIAL_FAILED_STATUS = 4;
const FAILED_STATUS = 5;
const CANCELLED_STATUS = 6;

const STATUS_MAP: Record<number, CampaignStatusLabel> = {
    [PENDING_APPROVAL_STATUS]: "pending_approval",
    [ACTIVE_STATUS]: "active",
    [IN_PROGRESS_STATUS]: "in_progress",
    [COMPLETED_STATUS]: "completed",
    [PARTIAL_FAILED_STATUS]: "partial_failed",
    [FAILED_STATUS]: "failed",
    [CANCELLED_STATUS]: "cancelled",
};

const CREATE_CAMPAIGN_GAS_BASE = 900_000n;
const CREATE_CAMPAIGN_GAS_PER_MILESTONE = 180_000n;
const CREATE_CAMPAIGN_GAS_MAX = 8_000_000n;

type CreateCampaignWithGoalPayload = {
    goalWei: bigint;
    allocationBps: number[];
    deadlines: number[];
    fundingDeadline: number;
    reviewerSafe: Address;
};

function toStatusLabel(status: number): CampaignStatusLabel {
    return STATUS_MAP[status] ?? "active";
}

function isTerminalStatus(status: number) {
    return [
        COMPLETED_STATUS,
        PARTIAL_FAILED_STATUS,
        FAILED_STATUS,
        CANCELLED_STATUS,
    ].includes(status);
}

function normalizeCampaign(
    raw: Partial<CampaignTuple> | null | undefined,
    fallbackId?: number,
) {
    const parsedId = Number(raw?.id ?? 0);
    const id =
        Number.isFinite(parsedId) && parsedId > 0
            ? parsedId
            : (fallbackId ?? 0);
    const status = Number(raw?.status ?? ACTIVE_STATUS);

    return {
        id,
        title: `Chiến dịch #${id}`,
        description:
            "Dữ liệu chiến dịch hiện chỉ có on-chain, chưa có metadata off-chain.",
        creator: (raw?.creator ??
            "0x0000000000000000000000000000000000000000") as Address,
        beneficiary: (raw?.beneficiary ??
            "0x0000000000000000000000000000000000000000") as Address,
        goal: raw?.goal ?? ZERO,
        raised: raw?.totalRaised ?? ZERO,
        totalRaised: raw?.totalRaised ?? ZERO,
        totalDisbursed: raw?.totalDisbursed ?? ZERO,
        deadline: Number(raw?.deadline ?? 0),
        withdrawn: Boolean(raw?.withdrawn),
        status,
        statusLabel: toStatusLabel(status),
        milestoneCount: Number(raw?.milestoneCount ?? 0n),
        currentMilestoneId: Number(raw?.currentMilestoneId ?? 0n),
        completed: isTerminalStatus(status),
        isActive:
            status === ACTIVE_STATUS || status === PENDING_APPROVAL_STATUS,
        isInProgress: status === IN_PROGRESS_STATUS,
    };
}

export function useReadCampaignCount() {
    const {
        data: campaignCount,
        isLoading,
        isError,
        error,
        refetch,
    } = useReadContract({
        ...contractConfig,
        functionName: "campaignCount",
        query: {
            staleTime: 30000,
            refetchOnWindowFocus: true,
            refetchOnMount: true,
            enabled: true,
        },
    });

    return {
        count: campaignCount ? Number(campaignCount) : 0,
        isLoading,
        isError,
        error: error?.message || null,
        refetch,
    };
}

export function useReadTotalRaised() {
    const { campaigns, isLoading, isError, error, refetch } =
        useReadAllCampaigns();
    const totalRaisedWei = useMemo(
        () => campaigns.reduce((sum, campaign) => sum + campaign.raised, ZERO),
        [campaigns],
    );

    return {
        totalRaised: parseFloat(formatEther(totalRaisedWei)),
        totalRaisedWei,
        isLoading,
        isError,
        error,
        refetch,
    };
}

export function useReadCampaign(campaignId: number | null | undefined) {
    const enabled =
        campaignId !== null && campaignId !== undefined && campaignId > 0;
    const campaignIdArg = enabled ? BigInt(campaignId) : undefined;

    const {
        data: campaignData,
        isLoading,
        isError,
        error,
        refetch,
    } = useReadContract({
        ...contractConfig,
        functionName: "getCampaign",
        args: campaignIdArg ? [campaignIdArg] : undefined,
        query: {
            staleTime: 30000,
            refetchOnWindowFocus: true,
            refetchOnMount: true,
            enabled,
        },
    });

    const campaign = useMemo(() => {
        const rawCampaign = (campaignData as CampaignTuple | undefined) ?? null;
        if (!rawCampaign) return null;

        return {
            ...normalizeCampaign(rawCampaign as CampaignTuple),
            reviewerSafe:
                "0x0000000000000000000000000000000000000000" as Address,
        };
    }, [campaignData]);

    return {
        campaign,
        isLoading,
        isError,
        error: error?.message || null,
        refetch,
    };
}

export function useReadAllCampaigns() {
    const countQuery = useReadCampaignCount();
    const campaignCount = countQuery.count;

    const contracts = useMemo(
        () =>
            Array.from({ length: campaignCount }, (_, i) => ({
                ...contractConfig,
                functionName: "getCampaign" as const,
                args: [BigInt(i + 1)] as const,
            })),
        [campaignCount],
    );

    const {
        data: campaignsData,
        isLoading: isLoadingCampaigns,
        isError,
        error,
        refetch: refetchCampaigns,
    } = useReadContracts({
        contracts,
        query: {
            staleTime: 60000,
            refetchOnWindowFocus: false,
            refetchOnMount: true,
            enabled:
                CROWDFUNDING_CONTRACT_ADDRESS !==
                    "0x0000000000000000000000000000000000000000" &&
                campaignCount > 0,
        },
    });

    const campaigns = useMemo(() => {
        if (!campaignsData) return [];

        const normalized = (
            campaignsData as Array<{ result?: CampaignTuple } | CampaignTuple>
        )
            .map((item, index) => {
                const raw = (item as { result?: CampaignTuple }).result;
                if (!raw) return null;
                return normalizeCampaign(raw, index + 1);
            })
            .filter(
                (campaign): campaign is NonNullable<typeof campaign> =>
                    campaign !== null,
            );

        const seen = new Set<number>();
        return normalized.filter((campaign) => {
            if (!Number.isFinite(campaign.id) || campaign.id <= 0) return false;
            if (seen.has(campaign.id)) return false;
            seen.add(campaign.id);
            return true;
        });
    }, [campaignsData]);

    const refetch = async () => {
        await Promise.all([countQuery.refetch(), refetchCampaigns()]);
    };

    return {
        campaigns,
        count: campaigns.length,
        isLoading: countQuery.isLoading || isLoadingCampaigns,
        isError: countQuery.isError || isError,
        error: error?.message || null,
        refetch,
    };
}

export function useContractStats() {
    const campaignCount = useReadCampaignCount();
    const totalRaised = useReadTotalRaised();

    const isLoading = campaignCount.isLoading || totalRaised.isLoading;
    const isError = campaignCount.isError || totalRaised.isError;
    const errors = [campaignCount.error, totalRaised.error].filter(
        (e) => e !== null,
    );

    const refetch = async () => {
        await Promise.all([campaignCount.refetch(), totalRaised.refetch()]);
    };

    return {
        campaignCount: campaignCount.count,
        totalRaised: totalRaised.totalRaised,
        totalRaisedWei: totalRaised.totalRaisedWei,
        isLoading,
        isError,
        errors,
        refetch,
    };
}

export function useReadFilteredCampaigns(isCompleted?: boolean) {
    const { campaigns, isLoading, isError, error, refetch } =
        useReadAllCampaigns();

    const filteredCampaigns =
        isCompleted !== undefined
            ? campaigns.filter((c) => c.completed === isCompleted)
            : campaigns;

    return {
        campaigns: filteredCampaigns,
        count: filteredCampaigns.length,
        isLoading,
        isError,
        error,
        refetch,
    };
}

export function useDonateToCampaign() {
    const { writeContractAsync, data, isPending, error } = useWriteContract();

    const donate = (campaignId: number, amountEth: string) => {
        return writeContractAsync({
            ...contractConfig,
            functionName: "donate",
            args: [BigInt(campaignId)],
            value: parseEther(amountEth),
        });
    };

    return {
        donate,
        hash: data,
        isPending,
        error,
    };
}

export function useCreateCampaign() {
    const { address } = useAccount();
    const publicClient = usePublicClient();
    const { writeContractAsync, data, isPending, error } = useWriteContract();

    const createCampaign = (payload: CreateCampaignWithGoalPayload) => {
        if (payload.goalWei <= 0n) {
            throw new Error("Campaign goal must be greater than zero.");
        }
        if (
            !payload.allocationBps.length ||
            payload.allocationBps.length !== payload.deadlines.length
        ) {
            throw new Error(
                "Milestone allocations and deadlines must have the same non-zero length.",
            );
        }

        const normalizedAllocations = payload.allocationBps.map(
            (value, index) => {
                if (!Number.isInteger(value) || value <= 0 || value > 10_000) {
                    throw new Error(
                        `Invalid allocation at milestone #${index + 1}.`,
                    );
                }
                return value;
            },
        );

        const totalAllocation = normalizedAllocations.reduce(
            (sum, value) => sum + value,
            0,
        );
        if (totalAllocation !== 10_000) {
            throw new Error(
                "Milestone allocation must sum to exactly 10000 bps.",
            );
        }

        const fundingDeadline = Math.floor(payload.fundingDeadline);
        if (
            !Number.isFinite(fundingDeadline) ||
            fundingDeadline <= Math.floor(Date.now() / 1000)
        ) {
            throw new Error("Funding deadline must be a future timestamp.");
        }

        const normalizedDeadlines = payload.deadlines.map((value, index) => {
            const deadline = Math.floor(value);
            if (!Number.isFinite(deadline) || deadline <= fundingDeadline) {
                throw new Error(
                    `Milestone deadline #${index + 1} must be after funding deadline.`,
                );
            }
            return BigInt(deadline);
        });

        const milestoneCount = BigInt(
            Math.max(normalizedAllocations.length, 1),
        );
        const computedGasLimit =
            CREATE_CAMPAIGN_GAS_BASE +
            CREATE_CAMPAIGN_GAS_PER_MILESTONE * milestoneCount;
        const gas =
            computedGasLimit > CREATE_CAMPAIGN_GAS_MAX
                ? CREATE_CAMPAIGN_GAS_MAX
                : computedGasLimit;

        const args = [
            payload.goalWei,
            normalizedAllocations,
            normalizedDeadlines,
            BigInt(fundingDeadline),
            payload.reviewerSafe,
        ] as const;

        const run = async () => {
            if (!publicClient) {
                throw new Error(
                    "Unable to connect RPC before sending transaction.",
                );
            }
            if (!address) {
                throw new Error(
                    "Wallet address is unavailable for transaction simulation.",
                );
            }

            try {
                await publicClient.simulateContract({
                    ...contractConfig,
                    account: address,
                    functionName: "createCampaignWithGoal",
                    args,
                });
            } catch (simulationError) {
                const simulationMessage =
                    simulationError instanceof Error
                        ? simulationError.message.toLowerCase()
                        : "";
                if (
                    simulationMessage.includes(
                        "function selector was not recognized",
                    ) ||
                    simulationMessage.includes("function does not exist") ||
                    simulationMessage.includes("execution reverted")
                ) {
                    throw new Error(
                        "The deployed contract does not match createCampaignWithGoal ABI. Please verify contract address and ABI version.",
                    );
                }
                throw simulationError;
            }

            return writeContractAsync({
                ...contractConfig,
                functionName: "createCampaignWithGoal",
                args,
                gas,
            });
        };

        return run();
    };

    return {
        createCampaign,
        hash: data,
        isPending,
        error,
    };
}

export function useReadReviewerSafes() {
    const { data, isLoading, isError, error, refetch } = useReadContract({
        ...contractConfig,
        functionName: "getReviewerSafes",
        query: {
            staleTime: 30_000,
            refetchOnWindowFocus: true,
        },
    });

    return {
        reviewerSafes: Array.isArray(data)
            ? (data as string[]).map((item) => item.toLowerCase())
            : [],
        isLoading,
        isError,
        error: error?.message || null,
        refetch,
    };
}

export function useReadContractOwner() {
    const { data, isLoading, isError, error, refetch } = useReadContract({
        ...contractConfig,
        functionName: "owner",
        query: {
            staleTime: 30_000,
            refetchOnWindowFocus: true,
        },
    });

    return {
        owner: ((data as string) || "").toLowerCase(),
        isLoading,
        isError,
        error: error?.message || null,
        refetch,
    };
}

export function useAdminApproveCampaign() {
    const { writeContractAsync, data, isPending, error } = useWriteContract();

    const adminApproveCampaign = (campaignId: number) =>
        writeContractAsync({
            ...contractConfig,
            functionName: "adminApprove",
            args: [BigInt(campaignId)],
        });

    return {
        adminApproveCampaign,
        hash: data,
        isPending,
        error,
    };
}

export function useAddReviewerSafe() {
    const { writeContractAsync, data, isPending, error } = useWriteContract();
    const addReviewerSafe = (safe: Address) =>
        writeContractAsync({
            ...contractConfig,
            functionName: "addReviewerSafe",
            args: [safe],
        });
    return { addReviewerSafe, hash: data, isPending, error };
}

export function useRemoveReviewerSafe() {
    const { writeContractAsync, data, isPending, error } = useWriteContract();
    const removeReviewerSafe = (safe: Address) =>
        writeContractAsync({
            ...contractConfig,
            functionName: "removeReviewerSafe",
            args: [safe],
        });
    return { removeReviewerSafe, hash: data, isPending, error };
}

export function useWithdrawFunds() {
    const { writeContractAsync, data, isPending, error } = useWriteContract();

    const withdrawFunds = (campaignId: number, milestoneId: number) => {
        return writeContractAsync({
            ...contractConfig,
            functionName: "disburseMilestone",
            args: [BigInt(campaignId), BigInt(milestoneId)],
        });
    };

    return {
        withdrawFunds,
        hash: data,
        isPending,
        error,
    };
}

export function useRefundDonation() {
    const { writeContractAsync, data, isPending, error } = useWriteContract();

    const refund = (campaignId: number) => {
        return writeContractAsync({
            ...contractConfig,
            functionName: "claimFundingRefund",
            args: [BigInt(campaignId)],
        });
    };

    return {
        refund,
        hash: data,
        isPending,
        error,
    };
}

export function useMarkAsFailed() {
    const { writeContractAsync, data, isPending, error } = useWriteContract();

    const markAsFailed = (campaignId: number) => {
        return writeContractAsync({
            ...contractConfig,
            functionName: "markCampaignFailed",
            args: [BigInt(campaignId)],
        });
    };

    return {
        markAsFailed,
        hash: data,
        isPending,
        error,
    };
}

export function useSubmitMilestoneProof() {
    const { writeContractAsync, data, isPending, error } = useWriteContract();

    const submitMilestoneProof = (
        campaignId: number,
        milestoneId: number,
        ipfsCid: string,
    ) => {
        return writeContractAsync({
            ...contractConfig,
            functionName: "submitMilestoneProof",
            args: [BigInt(campaignId), BigInt(milestoneId), ipfsCid],
        });
    };

    return {
        submitMilestoneProof,
        hash: data,
        isPending,
        error,
    };
}

export function useApproveMilestone() {
    const { writeContractAsync, data, isPending, error } = useWriteContract();

    const approveMilestone = (campaignId: number, milestoneId: number) => {
        return writeContractAsync({
            ...contractConfig,
            functionName: "approveMilestone",
            args: [BigInt(campaignId), BigInt(milestoneId)],
        });
    };

    return {
        approveMilestone,
        hash: data,
        isPending,
        error,
    };
}

export function useDisburseMilestone() {
    const { writeContractAsync, data, isPending, error } = useWriteContract();

    const disburseMilestone = (campaignId: number, milestoneId: number) => {
        return writeContractAsync({
            ...contractConfig,
            functionName: "disburseMilestone",
            args: [BigInt(campaignId), BigInt(milestoneId)],
        });
    };

    return {
        disburseMilestone,
        hash: data,
        isPending,
        error,
    };
}

export function useMarkMilestoneFailed() {
    const { writeContractAsync, data, isPending, error } = useWriteContract();

    const markMilestoneFailed = (campaignId: number, milestoneId: number) => {
        return writeContractAsync({
            ...contractConfig,
            functionName: "markMilestoneFailed",
            args: [BigInt(campaignId), BigInt(milestoneId)],
        });
    };

    return {
        markMilestoneFailed,
        hash: data,
        isPending,
        error,
    };
}

export function useClaimMilestoneRefund() {
    const { writeContractAsync, data, isPending, error } = useWriteContract();

    const claimMilestoneRefund = (campaignId: number, milestoneId: number) => {
        return writeContractAsync({
            ...contractConfig,
            functionName: "claimMilestoneRefund",
            args: [BigInt(campaignId), BigInt(milestoneId)],
        });
    };

    return {
        claimMilestoneRefund,
        hash: data,
        isPending,
        error,
    };
}

export function useClaimFundingRefund() {
    const { writeContractAsync, data, isPending, error } = useWriteContract();

    const claimFundingRefund = (campaignId: number) => {
        return writeContractAsync({
            ...contractConfig,
            functionName: "claimFundingRefund",
            args: [BigInt(campaignId)],
        });
    };

    return {
        claimFundingRefund,
        hash: data,
        isPending,
        error,
    };
}

export function useMintCertificate() {
    const { writeContractAsync, data, isPending, error } = useWriteContract();

    const mintCertificate = (campaignId: number) => {
        return writeContractAsync({
            ...contractConfig,
            functionName: "mintCertificate",
            args: [BigInt(campaignId)],
        });
    };

    return {
        mintCertificate,
        hash: data,
        isPending,
        error,
    };
}

/** On-chain proofCids per milestone index (0-based). */
export function useReadMilestonesOnChain(
    campaignId: number | null | undefined,
    milestoneCount: number,
) {
    const enabled =
        campaignId !== null &&
        campaignId !== undefined &&
        campaignId > 0 &&
        milestoneCount > 0;

    const contracts = useMemo(
        () =>
            Array.from({ length: milestoneCount }, (_, i) => ({
                ...contractConfig,
                functionName: "getMilestone" as const,
                args: [BigInt(campaignId as number), BigInt(i)] as const,
            })),
        [campaignId, milestoneCount],
    );

    const { data, isLoading, refetch } = useReadContracts({
        contracts,
        query: {
            enabled,
            staleTime: 15_000,
        },
    });

    const proofCidsByIndex = useMemo(() => {
        const out = new Map<number, string[]>();
        if (!data) return out;
        (
            data as Array<{
                result?: { proofCids?: readonly string[] };
            }>
        ).forEach((item, idx) => {
            const cids = item.result?.proofCids;
            out.set(idx, Array.isArray(cids) ? [...cids] : []);
        });
        return out;
    }, [data]);

    return { proofCidsByIndex, isLoading, refetch };
}

/** campaignReviewerSafe(campaignId) for all campaigns 1..count */
export function useReadCampaignReviewersBatch(campaignCount: number) {
    const contracts = useMemo(
        () =>
            Array.from({ length: campaignCount }, (_, i) => ({
                ...contractConfig,
                functionName: "campaignReviewerSafe" as const,
                args: [BigInt(i + 1)] as const,
            })),
        [campaignCount],
    );

    const { data, isLoading, refetch } = useReadContracts({
        contracts,
        query: {
            enabled:
                CROWDFUNDING_CONTRACT_ADDRESS !==
                    "0x0000000000000000000000000000000000000000" &&
                campaignCount > 0,
            staleTime: 30_000,
        },
    });

    const reviewersByCampaignId = useMemo(() => {
        const map = new Map<number, Address>();
        if (!data) return map;
        (
            data as Array<{
                result?: Address;
            }>
        ).forEach((item, i) => {
            const addr = item.result;
            if (
                addr &&
                typeof addr === "string" &&
                addr !== "0x0000000000000000000000000000000000000000"
            ) {
                map.set(i + 1, addr as Address);
            }
        });
        return map;
    }, [data]);

    return { reviewersByCampaignId, isLoading, refetch };
}
