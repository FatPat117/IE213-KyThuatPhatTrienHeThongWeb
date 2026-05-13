"use client";

import { useMemo } from "react";
import { Address, encodeFunctionData, encodePacked, formatEther, getAddress, hashTypedData, keccak256, parseEther, recoverAddress, toBytes } from "viem";

import {
    useAccount,
    usePublicClient,
    useReadContract,
    useReadContracts,
    useSignTypedData,
    useWriteContract,
} from "wagmi";
import { CROWDFUNDING_ABI, CROWDFUNDING_CONTRACT_ADDRESS, SEPOLIA_CHAIN_ID, contractConfig } from "./config";

// ── DEBUG: kiểm tra địa chỉ contract đang dùng ──
console.log(
    "[hooks] CROWDFUNDING_CONTRACT_ADDRESS =",
    CROWDFUNDING_CONTRACT_ADDRESS,
);
console.log("[hooks] contractConfig =", contractConfig);

// ── ADMIN_ROLE: keccak256("ADMIN_ROLE") – matches Solidity constant ──
const ADMIN_ROLE = keccak256(toBytes("ADMIN_ROLE")) as `0x${string}`;

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
const REVIEWER_REGISTRY_ABI = [
    {
        type: "function",
        name: "getReviewerSafes",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "address[]" }],
    },
    {
        type: "function",
        name: "reviewerSafes",
        stateMutability: "view",
        inputs: [{ name: "safe", type: "address" }],
        outputs: [{ name: "", type: "bool" }],
    },
    {
        type: "function",
        name: "addReviewerSafe",
        stateMutability: "nonpayable",
        inputs: [{ name: "safe", type: "address" }],
        outputs: [],
    },
    {
        type: "function",
        name: "removeReviewerSafe",
        stateMutability: "nonpayable",
        inputs: [{ name: "safe", type: "address" }],
        outputs: [],
    },
] as const;

async function readReviewerSafeExists(
    publicClient: NonNullable<ReturnType<typeof usePublicClient>>,
    safe: Address,
) {
    console.log(
        "[readReviewerSafeExists] contract =",
        CROWDFUNDING_CONTRACT_ADDRESS,
    );
    console.log("[readReviewerSafeExists] safe =", safe);
    try {
        const safes = (await publicClient.readContract({
            address: CROWDFUNDING_CONTRACT_ADDRESS,
            abi: REVIEWER_REGISTRY_ABI,
            functionName: "getReviewerSafes",
        })) as Address[];
        console.log(
            "[readReviewerSafeExists] getReviewerSafes result =",
            safes,
        );
        const normalizedSafe = safe.toLowerCase();
        safes.forEach((item, i) => {
            console.log(
                `[compare] safes[${i}] =`,
                JSON.stringify(item.toLowerCase()),
            );
            console.log(
                `[compare] normalizedSafe =`,
                JSON.stringify(normalizedSafe),
            );
            console.log(
                `[compare] match =`,
                item.toLowerCase() === normalizedSafe,
            );
        });
        return safes.some((item) => item.toLowerCase() === normalizedSafe);
    } catch {
        // Fallback for deployments that only expose reviewerSafes mapping getter.
        try {
            const approved = (await publicClient.readContract({
                address: CROWDFUNDING_CONTRACT_ADDRESS,
                abi: REVIEWER_REGISTRY_ABI,
                functionName: "reviewerSafes",
                args: [safe],
            })) as boolean;
            console.log(
                "[readReviewerSafeExists] reviewerSafes result =",
                approved,
            );
            return approved;
        } catch {
            console.log(
                "[readReviewerSafeExists] Error occurred while checking reviewer safe existence.",
            );
            return null;
        }
    }
}

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

// ── GLOBAL CACHE cho Safe owners & threshold (giảm rate limit) ──
const SAFE_INFO_CACHE_TTL_MS = 30 * 60 * 1000; // 30 phút
const SAFE_INFO_CACHE = new Map<string, { owners: string[]; threshold: number; expiresAt: number }>();

async function getSafeOwnersAndThreshold(safe: string): Promise<{ owners: string[]; threshold: number }> {
    // Validate and convert to checksum first
    let checksumSafe: string;
    try {
        checksumSafe = getAddress(safe as Address);
    } catch (error) {
        console.error('[getSafeOwnersAndThreshold] Invalid address:', safe, error);
        throw new Error(`Invalid Safe address: ${safe}`);
    }

    const normalizedSafe = checksumSafe.toLowerCase();
    const cached = SAFE_INFO_CACHE.get(normalizedSafe);
    const now = Date.now();

    if (cached && now < cached.expiresAt) {
        console.log('[SafeInfoCache] Cache HIT for', normalizedSafe, '->', cached.owners.length, 'owners, threshold:', cached.threshold);
        return { owners: cached.owners, threshold: cached.threshold };
    }

    console.log('[SafeInfoCache] Cache MISS for', normalizedSafe, '- fetching from API');

    // Fetch owners & threshold together từ Safe API using CHECKSUM address
    const safeInfoRes = await fetch(
        `https://safe-transaction-sepolia.safe.global/api/v1/safes/${checksumSafe}/`,
        { cache: "no-store" }
    );

    if (!safeInfoRes.ok) {
        throw new Error(`Không thể lấy thông tin Safe: ${safeInfoRes.status}`);
    }

    const safeInfo = await safeInfoRes.json();
    const owners = Array.isArray(safeInfo.owners) ? safeInfo.owners.map((o: string) => o.toLowerCase()) : [];
    const threshold = safeInfo.threshold;

    // Update cache
    SAFE_INFO_CACHE.set(normalizedSafe, {
        owners,
        threshold,
        expiresAt: now + SAFE_INFO_CACHE_TTL_MS,
    });

    return { owners, threshold };
}

async function getSafeNonceFresh(safe: string): Promise<number> {
    // Validate and convert to checksum first
    let checksumSafe: string;
    try {
        checksumSafe = getAddress(safe as Address);
    } catch (error) {
        console.error('[getSafeNonceFresh] Invalid address:', safe, error);
        throw new Error(`Invalid Safe address: ${safe}`);
    }

    // Always fetch fresh nonce (nonce changes with each transaction)
    const safeInfoRes = await fetch(
        `https://safe-transaction-sepolia.safe.global/api/v1/safes/${checksumSafe}/`,
        { cache: "no-store" }
    );

    if (!safeInfoRes.ok) {
        throw new Error(`Không thể lấy nonce của Safe: ${safeInfoRes.status}`);
    }

    const safeInfo = await safeInfoRes.json();
    const nonce = safeInfo.nonce;

    if (typeof nonce === "undefined") {
        throw new Error("Safe API trả về dữ liệu không hợp lệ (thiếu nonce).");
    }

    return nonce;
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
            "Dữ liệu chiến dịch hiện chỉ đang được đồng bộ giữa on-chain và backend. Vui lòng kiểm tra lại sau.",
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
    const countQuery = useReadCampaignCount();
    const hasValidInput =
        campaignId !== null && campaignId !== undefined && campaignId > 0;
    const isOutOfRange =
        hasValidInput && !countQuery.isLoading && campaignId > countQuery.count;
    const enabled = hasValidInput && !isOutOfRange;
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
        isLoading: countQuery.isLoading || isLoading,
        isError: isOutOfRange || isError,
        error: isOutOfRange
            ? `Campaign #${campaignId} does not exist on-chain.`
            : error?.message || null,
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
    const {
        data: reviewerSafesOnChain,
        isLoading: isLoadingReviewerSafesOnChain,
        refetch: refetchReviewerSafesOnChain,
    } = useReadContract({
        address: CROWDFUNDING_CONTRACT_ADDRESS,
        abi: REVIEWER_REGISTRY_ABI,
        functionName: "getReviewerSafes",
        query: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            refetchOnMount: true,
            enabled:
                CROWDFUNDING_CONTRACT_ADDRESS !==
                "0x0000000000000000000000000000000000000000",
        },
    });

    const countQuery = useReadCampaignCount();
    const {
        reviewersByCampaignId,
        isLoading: isLoadingReviewers,
        isError: isErrorReviewers,
        error: reviewerError,
        refetch: refetchReviewers,
    } = useReadCampaignReviewersBatch(countQuery.count);

    const reviewerSafes = useMemo(() => {
        const onChainList = Array.isArray(reviewerSafesOnChain)
            ? reviewerSafesOnChain
                .map((item) => item.toLowerCase())
                .filter((item) => /^0x[a-f0-9]{40}$/.test(item))
            : [];
        if (onChainList.length > 0) {
            return Array.from(new Set(onChainList));
        }

        return Array.from(
            new Set(
                Array.from(reviewersByCampaignId.values())
                    .map((item) => item.toLowerCase())
                    .filter((item) => /^0x[a-f0-9]{40}$/.test(item)),
            ),
        );
    }, [reviewerSafesOnChain, reviewersByCampaignId]);

    return {
        reviewerSafes,
        isLoading:
            isLoadingReviewerSafesOnChain ||
            countQuery.isLoading ||
            isLoadingReviewers,
        isError: countQuery.isError || isErrorReviewers,
        error: countQuery.error || reviewerError,
        refetch: async () => {
            await Promise.all([
                refetchReviewerSafesOnChain(),
                countQuery.refetch(),
                refetchReviewers(),
            ]);
        },
    };
}

export function useReadReviewerSafesOnChain() {
    const {
        data: reviewerSafesOnChain,
        isLoading,
        isError,
        error,
        refetch,
    } = useReadContract({
        address: CROWDFUNDING_CONTRACT_ADDRESS,
        abi: REVIEWER_REGISTRY_ABI,
        functionName: "getReviewerSafes",
        query: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            refetchOnMount: true,
            enabled:
                CROWDFUNDING_CONTRACT_ADDRESS !==
                "0x0000000000000000000000000000000000000000",
        },
    });

    const reviewerSafes = useMemo(() => {
        const onChainList = Array.isArray(reviewerSafesOnChain)
            ? reviewerSafesOnChain
                .map((item) => item.toLowerCase())
                .filter((item) => /^0x[a-f0-9]{40}$/.test(item))
            : [];
        return Array.from(new Set(onChainList));
    }, [reviewerSafesOnChain]);

    return {
        reviewerSafes,
        isLoading,
        isError,
        error: error?.message || null,
        refetch,
    };
}

export function useIsAdminOnChain() {
    const { address } = useAccount();
    const { data: isAdmin, isLoading, isError, error, refetch } = useReadContract({
        ...contractConfig,
        functionName: "hasRole",
        args: address ? [ADMIN_ROLE, address] : undefined,
        query: {
            enabled: !!address,
        },
    });

    return {
        isAdmin: !!isAdmin,
        isLoading,
        isError,
        error,
        refetch,
    };
}

export function useReadContractOwner() {
    const { isAdmin, isLoading, isError, error, refetch } = useIsAdminOnChain();

    return {
        owner: "", // Deprecated
        isAdminOnChain: isAdmin,
        isLoading,
        isError,
        error,
        refetch,
    };
}

export function useAdminApproveCampaign() {
    const { address } = useAccount();
    const publicClient = usePublicClient();
    const { writeContractAsync, data, isPending, error } = useWriteContract();
    const ADMIN_APPROVE_GAS_LIMIT_CAP = 500_000n;

    const adminApproveCampaign = async (campaignId: number) => {
        if (!publicClient) {
            throw new Error("Không thể kết nối RPC để ước lượng gas.");
        }
        if (!address) {
            throw new Error("Không tìm thấy địa chỉ ví để gửi giao dịch.");
        }

        //   Kiểm tra quyền ADMIN_ROLE thay vì owner()
        const isAdmin = (await publicClient
            .readContract({
                address: CROWDFUNDING_CONTRACT_ADDRESS,
                abi: contractConfig.abi,
                functionName: "hasRole",
                args: [ADMIN_ROLE, address],
            })
            .catch(() => null)) as boolean | null;
        if (isAdmin === false) {
            throw new Error(
                `Ví (${address}) không có quyền ADMIN_ROLE để thực hiện hành động này.`,
            );
        }

        const args = [BigInt(campaignId)] as const;
        let gas: bigint | undefined;
        try {
            const estimatedGas = await publicClient.estimateContractGas({
                ...contractConfig,
                account: address,
                functionName: "adminApprove",
                args,
            });
            const bufferedGas = (estimatedGas * 120n) / 100n;
            gas =
                bufferedGas > ADMIN_APPROVE_GAS_LIMIT_CAP
                    ? ADMIN_APPROVE_GAS_LIMIT_CAP
                    : bufferedGas;
        } catch (estimateError) {
            const message =
                estimateError instanceof Error
                    ? estimateError.message.toLowerCase()
                    : "";
            if (message.includes("gas limit too high")) {
                throw new Error(
                    "Ước lượng gas vượt mức cho phép của RPC. Vui lòng thử lại, hệ thống sẽ dùng gas an toàn.",
                );
            }
            throw estimateError;
        }

        return writeContractAsync({
            ...contractConfig,
            functionName: "adminApprove",
            args,
            gas,
        });
    };

    return {
        adminApproveCampaign,
        hash: data,
        isPending,
        error,
    };
}

export function useAdminRejectCampaign() {
    const { address } = useAccount();
    const publicClient = usePublicClient();
    const { writeContractAsync, data, isPending, error } = useWriteContract();
    const ADMIN_REJECT_GAS_LIMIT_CAP = 300_000n;

    const adminRejectCampaign = async (campaignId: number, reason: string) => {
        if (!publicClient) {
            throw new Error("Không thể kết nối RPC để ước lượng gas.");
        }
        if (!address) {
            throw new Error("Không tìm thấy địa chỉ ví để gửi giao dịch.");
        }

        const isAdmin = (await publicClient
            .readContract({
                address: CROWDFUNDING_CONTRACT_ADDRESS,
                abi: contractConfig.abi,
                functionName: "hasRole",
                args: [ADMIN_ROLE, address],
            })
            .catch(() => null)) as boolean | null;

        if (isAdmin === false) {
            throw new Error(
                `Ví (${address}) không có quyền ADMIN_ROLE để thực hiện hành động này.`,
            );
        }

        const args = [BigInt(campaignId), reason] as const;
        let gas: bigint | undefined;
        try {
            const estimatedGas = await publicClient.estimateContractGas({
                ...contractConfig,
                account: address,
                functionName: "adminReject",
                args,
            });
            const bufferedGas = (estimatedGas * 120n) / 100n;
            gas =
                bufferedGas > ADMIN_REJECT_GAS_LIMIT_CAP
                    ? ADMIN_REJECT_GAS_LIMIT_CAP
                    : bufferedGas;
        } catch (estimateError) {
            console.warn("[useAdminRejectCampaign] Gas estimation failed:", estimateError);
        }

        return writeContractAsync({
            ...contractConfig,
            functionName: "adminReject",
            args,
            gas,
        });
    };

    return {
        adminRejectCampaign,
        hash: data,
        isPending,
        error,
    };
}

export function useAddReviewerSafe() {
    const { address } = useAccount();
    const publicClient = usePublicClient();
    const { writeContractAsync, data, isPending, error } = useWriteContract();
    const addReviewerSafe = async (safe: Address) => {
        if (!publicClient) {
            throw new Error("Không thể kết nối RPC để ước lượng gas.");
        }
        if (!address) {
            throw new Error("Không tìm thấy địa chỉ ví để gửi giao dịch.");
        }
        const normalizedSafe = safe.toLowerCase() as Address;
        //   Kiểm tra quyền ADMIN_ROLE thay vì owner()
        const isAdmin = (await publicClient
            .readContract({
                address: CROWDFUNDING_CONTRACT_ADDRESS,
                abi: contractConfig.abi,
                functionName: "hasRole",
                args: [ADMIN_ROLE, address],
            })
            .catch(() => null)) as boolean | null;
        if (isAdmin === false) {
            throw new Error(
                `Ví (${address}) không có quyền ADMIN_ROLE để thêm reviewer.`,
            );
        }

        const reviewerState = await readReviewerSafeExists(
            publicClient,
            normalizedSafe,
        );
        if (reviewerState === null) {
            throw new Error(
                "Contract hiện tại không đọc được reviewer registry (getReviewerSafes/reviewerSafes đều revert). Có thể bạn đang trỏ sai address hoặc contract này là phiên bản cũ chưa có tính năng reviewer safe.",
            );
        }
        if (reviewerState === true) {
            throw new Error("Reviewer safe này đã tồn tại trong danh sách.");
        }

        let estimatedGas: bigint;
        try {
            estimatedGas = await publicClient.estimateContractGas({
                address: CROWDFUNDING_CONTRACT_ADDRESS,
                abi: REVIEWER_REGISTRY_ABI,
                functionName: "addReviewerSafe",
                args: [normalizedSafe],
                account: address,
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : "";
            const normalizedMessage = message.toLowerCase();
            const rawRevertData =
                typeof error === "object" &&
                    error !== null &&
                    "cause" in error &&
                    typeof (error as { cause?: unknown }).cause === "object" &&
                    (error as { cause?: unknown }).cause !== null &&
                    "raw" in ((error as { cause?: { raw?: unknown } }).cause || {})
                    ? (error as { cause?: { raw?: string } }).cause?.raw
                    : undefined;
            if (
                normalizedMessage.includes("accesscontrolunauthorizedaccount") ||
                normalizedMessage.includes("caller is not the owner") ||
                normalizedMessage.includes("execution reverted")
            ) {
                if (rawRevertData === "0x") {
                    throw new Error(
                        "Contract đang revert không kèm reason (raw 0x). Khả năng cao ABI/address hiện tại không khớp phiên bản contract đã deploy, hoặc hàm addReviewerSafe không tồn tại ở địa chỉ này.",
                    );
                }
                throw new Error(
                    "Contract từ chối addReviewerSafe. Ví không có quyền ADMIN_ROLE.",
                );
            }
            if (normalizedMessage.includes("reviewer already approved")) {
                throw new Error(
                    "Reviewer safe này đã tồn tại trong danh sách.",
                );
            }
            throw error;
        }
        const gasWithBuffer = (estimatedGas * 120n) / 100n;

        return writeContractAsync({
            address: CROWDFUNDING_CONTRACT_ADDRESS,
            abi: REVIEWER_REGISTRY_ABI,
            chainId: contractConfig.chainId,
            functionName: "addReviewerSafe",
            args: [normalizedSafe],
            gas: gasWithBuffer,
        });
    };
    return { addReviewerSafe, hash: data, isPending, error };
}

export function useRemoveReviewerSafe() {
    const { address } = useAccount();
    const publicClient = usePublicClient();
    const { writeContractAsync, data, isPending, error } = useWriteContract();
    const removeReviewerSafe = async (safe: Address) => {
        if (!publicClient) {
            throw new Error("Không thể kết nối RPC để ước lượng gas.");
        }
        if (!address) {
            throw new Error("Không tìm thấy địa chỉ ví để gửi giao dịch.");
        }
        const normalizedSafe = safe.toLowerCase() as Address;
        //   Kiểm tra quyền ADMIN_ROLE thay vì owner()
        const isAdmin = (await publicClient
            .readContract({
                address: CROWDFUNDING_CONTRACT_ADDRESS,
                abi: contractConfig.abi,
                functionName: "hasRole",
                args: [ADMIN_ROLE, address],
            })
            .catch(() => null)) as boolean | null;
        if (isAdmin === false) {
            throw new Error(
                `Ví (${address}) không có quyền ADMIN_ROLE để xóa reviewer.`,
            );
        }

        const reviewerState = await readReviewerSafeExists(
            publicClient,
            normalizedSafe,
        );
        if (reviewerState === null) {
            throw new Error(
                "Contract hiện tại không đọc được reviewer registry (getReviewerSafes/reviewerSafes đều revert). Có thể bạn đang trỏ sai address hoặc contract này là phiên bản cũ chưa có tính năng reviewer safe.",
            );
        }
        if (reviewerState === false) {
            throw new Error("Reviewer safe này chưa có trong danh sách.");
        }

        let estimatedGas: bigint;
        try {
            estimatedGas = await publicClient.estimateContractGas({
                address: CROWDFUNDING_CONTRACT_ADDRESS,
                abi: REVIEWER_REGISTRY_ABI,
                functionName: "removeReviewerSafe",
                args: [normalizedSafe],
                account: address,
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : "";
            const normalizedMessage = message.toLowerCase();
            if (
                normalizedMessage.includes("accesscontrolunauthorizedaccount") ||
                normalizedMessage.includes("caller is not the owner") ||
                normalizedMessage.includes("execution reverted")
            ) {
                throw new Error(
                    "Contract từ chối removeReviewerSafe. Ví không có quyền ADMIN_ROLE.",
                );
            }
            if (normalizedMessage.includes("reviewer not approved")) {
                throw new Error("Reviewer safe này chưa có trong danh sách.");
            }
            throw error;
        }
        const gasWithBuffer = (estimatedGas * 120n) / 100n;

        return writeContractAsync({
            address: CROWDFUNDING_CONTRACT_ADDRESS,
            abi: REVIEWER_REGISTRY_ABI,
            chainId: contractConfig.chainId,
            functionName: "removeReviewerSafe",
            args: [normalizedSafe],
            gas: gasWithBuffer,
        });
    };
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
    const { address } = useAccount();
    const publicClient = usePublicClient();
    const { writeContractAsync, data, isPending, error } = useWriteContract();
    const SUBMIT_PROOF_DEFAULT_GAS = 350_000n;

    const submitMilestoneProof = async (
        campaignId: number,
        milestoneId: number,
        ipfsCid: string,
    ) => {
        if (!publicClient) {
            throw new Error("Không thể kết nối RPC để ước lượng gas.");
        }
        if (!address) {
            throw new Error("Không tìm thấy địa chỉ ví để gửi giao dịch.");
        }

        const args = [
            BigInt(campaignId),
            BigInt(milestoneId),
            ipfsCid,
        ] as const;
        try {
            await publicClient.simulateContract({
                ...contractConfig,
                account: address,
                functionName: "submitMilestoneProof",
                args,
            });
        } catch (simulationError) {
            const message =
                simulationError instanceof Error
                    ? simulationError.message.toLowerCase()
                    : "";
            const rawMessage =
                simulationError instanceof Error
                    ? simulationError.message
                    : "Không thể mô phỏng giao dịch đăng tải minh chứng.";
            // Some RPCs return generic "gas limit too high" during estimation/simulation.
            // Continue and let the wallet send with a known-safe gas limit.
            if (message.includes("gas limit too high")) {
                // Continue using default gas fallback below.
            } else if (
                message.includes("campaign not in progress") ||
                message.includes("not in progress")
            ) {
                throw new Error(
                    "Chiến dịch chưa ở trạng thái In Progress nên chưa thể nộp minh chứng milestone on-chain.",
                );
            } else if (message.includes("execution reverted")) {
                throw new Error(
                    "Contract từ chối submit minh chứng. Vui lòng kiểm tra trạng thái chiến dịch/milestone trước khi gửi.",
                );
            } else {
                throw new Error(rawMessage);
            }
        }

        return writeContractAsync({
            ...contractConfig,
            functionName: "submitMilestoneProof",
            args,
            gas: SUBMIT_PROOF_DEFAULT_GAS,
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
    const { address } = useAccount();
    const publicClient = usePublicClient();
    const { writeContractAsync, data, isPending, error } = useWriteContract();
    const DISBURSE_MILESTONE_DEFAULT_GAS = 350_000n;

    const disburseMilestone = async (
        campaignId: number,
        milestoneId: number,
    ) => {
        if (!publicClient) {
            throw new Error("Không thể kết nối RPC để ước lượng gas.");
        }
        if (!address) {
            throw new Error("Không tìm thấy địa chỉ ví để gửi giao dịch.");
        }

        const args = [BigInt(campaignId), BigInt(milestoneId)] as const;
        try {
            await publicClient.simulateContract({
                ...contractConfig,
                account: address,
                functionName: "disburseMilestone",
                args,
            });
        } catch (simulationError) {
            const message =
                simulationError instanceof Error
                    ? simulationError.message.toLowerCase()
                    : "";
            const rawMessage =
                simulationError instanceof Error
                    ? simulationError.message
                    : "Không thể mô phỏng giao dịch giải ngân milestone.";
            if (message.includes("gas limit too high")) {
                // Some RPCs fail estimate/simulation for valid txs; fallback gas is applied below.
            } else if (message.includes("milestone not approved")) {
                throw new Error("Milestone hiện tại chưa được reviewer duyệt.");
            } else if (
                message.includes("only current milestone can be disbursed")
            ) {
                throw new Error("Chỉ có thể giải ngân milestone hiện tại.");
            } else if (message.includes("execution reverted")) {
                throw new Error(
                    "Contract từ chối giải ngân milestone. Vui lòng kiểm tra trạng thái chiến dịch/milestone.",
                );
            } else {
                throw new Error(rawMessage);
            }
        }

        return writeContractAsync({
            ...contractConfig,
            functionName: "disburseMilestone",
            args,
            gas: DISBURSE_MILESTONE_DEFAULT_GAS,
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

    const { data, isLoading, isError, error, refetch } = useReadContracts({
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

    return {
        reviewersByCampaignId,
        isLoading,
        isError,
        error: error?.message || null,
        refetch,
    };
}

/** Direct adminApprove for wallets with ADMIN_ROLE */
export function useAdminApprove() {
    const { writeContractAsync, data, isPending, error } = useWriteContract();
    const adminApprove = async (campaignId: number) => {
        return writeContractAsync({
            ...contractConfig,
            functionName: "adminApprove",
            args: [BigInt(campaignId)],
        });
    };
    return { adminApprove, hash: data, isPending, error };
}

/**
 * Hook for proposing Safe multisig transactions (for reviewer approvals)
 */
export function useProposeSafeTransaction() {
    const { address: walletAddress } = useAccount();
    const { signTypedDataAsync } = useSignTypedData();

    const propose = async (
        campaignId: number,
        milestoneId: number | null,
        reviewerSafe: Address
    ): Promise<{
        safeTxHash: string;
        safeUiUrl: string;
        message: string;
    }> => {
        if (!walletAddress) {
            throw new Error("Ví chưa kết nối. Vui lòng kết nối ví để đề xuất giao dịch.");
        }

        // 1. Encode function data based on milestoneId
        let encodedData: `0x${string}`;
        let functionName: string;

        if (milestoneId === null) {
            // adminApprove(uint256 campaignId)
            functionName = "adminApprove";
            encodedData = encodeFunctionData({
                abi: CROWDFUNDING_ABI,
                functionName: "adminApprove",
                args: [BigInt(campaignId)],
            });
        } else {
            // approveMilestone(uint256 campaignId, uint256 milestoneId)
            functionName = "approveMilestone";
            encodedData = encodeFunctionData({
                abi: CROWDFUNDING_ABI,
                functionName: "approveMilestone",
                args: [BigInt(campaignId), BigInt(milestoneId)],
            });
        }

        // 2. Fetch Safe owners & threshold from CACHE (30min TTL) + nonce FRESH
        // Validate reviewerSafe address first
        const normalizedReviewerSafe = (reviewerSafe || "").trim().toLowerCase();
        if (!/^0x[a-f0-9]{40}$/.test(normalizedReviewerSafe)) {
            throw new Error(`Invalid reviewerSafe address: "${reviewerSafe}". Expected a valid EVM address (0x + 40 hex chars).`);
        }
        const checksumSafe = getAddress(normalizedReviewerSafe as Address);

        // Owners & threshold: cached (shared across all instances)
        const { owners, threshold } = await getSafeOwnersAndThreshold(normalizedReviewerSafe);

        // Nonce: always fresh (required for transaction)
        const nonce = await getSafeNonceFresh(reviewerSafe);
        const normalizedWallet = walletAddress.toLowerCase();
        const isOwner = owners.some((owner: string) => owner.toLowerCase() === normalizedWallet);
        console.log('[useProposeSafeTransaction] Safe owners:', owners.map((o: string) => getAddress(o)));
        console.log('[useProposeSafeTransaction] Is wallet an owner?', isOwner);
        if (!isOwner) {
            const ownersList = owners.map((o: string) => getAddress(o)).join(', ');
            throw new Error(
                `Ví (${walletAddress}) không phải là owner của Safe ${checksumSafe}. ` +
                `Chỉ owner mới có thể đề xuất giao dịch.\n\n` +
                `Các owner hiện tại của Safe:\n${ownersList}\n\n` +
                `Vui lòng chuyển sang tài khoản là một trong các owner trên trong MetaMask.`
            );
        }

        // 3. Prepare EIP-712 typed data according to Safe specification
        // Domain: ONLY chainId and verifyingContract (no name/version)
        const domain = {
            chainId: SEPOLIA_CHAIN_ID,
            verifyingContract: checksumSafe,
        } as const;

        // Types: Full 10-field SafeTx schema (NOT the shortened version)
        const types = {
            SafeTx: [
                { name: "to", type: "address" },
                { name: "value", type: "uint256" },
                { name: "data", type: "bytes" },
                { name: "operation", type: "uint8" },
                { name: "safeTxGas", type: "uint256" },
                { name: "baseGas", type: "uint256" },
                { name: "gasPrice", type: "uint256" },
                { name: "gasToken", type: "address" },
                { name: "refundReceiver", type: "address" },
                { name: "nonce", type: "uint256" },
            ],
        } as const;

        // Message: Full transaction data matching the SafeTx schema
        const typedMessage = {
            to: CROWDFUNDING_CONTRACT_ADDRESS as Address,
            value: 0n,
            data: encodedData,
            operation: 0,
            safeTxGas: 0n,
            baseGas: 0n,
            gasPrice: 0n,
            gasToken: "0x0000000000000000000000000000000000000000" as Address,
            refundReceiver: "0x0000000000000000000000000000000000000000" as Address,
            nonce: BigInt(nonce),
        };

        // 4. Compute safeTxHash by hashing the typed data (Safe standard)
        const safeTxHash = hashTypedData({
            domain,
            types,
            primaryType: "SafeTx",
            message: typedMessage,
        });
        console.log('[useProposeSafeTransaction] safeTxHash (from typed data):', safeTxHash);

        // 5. Get EIP-712 signature from reviewer's wallet
        const signature = await signTypedDataAsync({
            domain,
            types,
            primaryType: "SafeTx" as const,
            message: typedMessage,
        });

        // 6. Verify the signature signer is one of the Safe owners
        let recoveredSigner: string;
        try {
            // Compute the typed data hash (digest) that was signed
            const digest = hashTypedData({
                domain,
                types,
                primaryType: "SafeTx",
                message: typedMessage,
            });
            console.log('[useProposeSafeTransaction] Typed data digest:', digest);

            // Recover the signer address from the signature and digest
            recoveredSigner = await recoverAddress({ hash: digest, signature });
            const normalizedRecovered = recoveredSigner.toLowerCase();
            const isRecoveredOwner = owners.some((owner: string) => owner.toLowerCase() === normalizedRecovered);
            console.log('[useProposeSafeTransaction] Recovered signer:', recoveredSigner);
            console.log('[useProposeSafeTransaction] Is recovered signer an owner?', isRecoveredOwner);

            if (!isRecoveredOwner) {
                throw new Error(
                    `Chữ ký được tạo bởi ${recoveredSigner} không phải là owner của Safe ${checksumSafe}. ` +
                    `Chỉ owner mới có thể ký. Các owner hiện tại: ${owners.map((o: string) => getAddress(o)).join(', ')}.`
                );
            }

            // Also verify the recovered signer matches the expected walletAddress
            if (normalizedRecovered !== normalizedWallet) {
                throw new Error(
                    `MetaMask đã sử dụng account ${recoveredSigner} để ký (khác với account kết nối ${walletAddress}). ` +
                    `Vui lòng chuyển sang account ${walletAddress} trong MetaMask và xác nhận lại.`
                );
            }
        } catch (signerError) {
            console.error('[useProposeSafeTransaction] Signature verification error:', signerError);
            throw signerError;
        }

        // 7. Final check before sending to Safe API
        console.log('[useProposeSafeTransaction] Final check before POST:', {
            sender: walletAddress,
            normalizedWallet,
            signature,
            owners: owners.map((o: string) => getAddress(o)),
            recoveredSigner,
        });

        // 8. DEBUG: Log values before sending
        console.log('[useProposeSafeTransaction] typedMessage:', typedMessage);
        console.log('[useProposeSafeTransaction] safeTxHash:', safeTxHash);
        console.log('[useProposeSafeTransaction] nonce:', nonce);
        console.log('[useProposeSafeTransaction] POST payload:', {
            to: CROWDFUNDING_CONTRACT_ADDRESS,
            value: "0",
            data: encodedData,
            operation: 0,
            safeTxGas: "0",
            baseGas: "0",
            gasPrice: "0",
            gasToken: "0x0000000000000000000000000000000000000000",
            refundReceiver: "0x0000000000000000000000000000000000000000",
            nonce: String(nonce),
            contractTransactionHash: safeTxHash,
            sender: walletAddress,
            signature,
        });

        // 9. Propose transaction to Safe Transaction Service
        const proposeRes = await fetch(
            `https://safe-transaction-sepolia.safe.global/api/v1/safes/${checksumSafe}/multisig-transactions/`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    to: CROWDFUNDING_CONTRACT_ADDRESS,
                    value: 0,
                    data: encodedData,
                    operation: 0,
                    safeTxGas: 0,
                    baseGas: 0,
                    gasPrice: 0,
                    gasToken: "0x0000000000000000000000000000000000000000",
                    refundReceiver: "0x0000000000000000000000000000000000000000",
                    nonce: String(nonce),
                    contractTransactionHash: safeTxHash,
                    sender: walletAddress,
                    signature,
                }),
            }
        );

        if (!proposeRes.ok) {
            let errBody: Record<string, unknown> = {};
            try {
                const errorText = await proposeRes.text();
                if (errorText && errorText.length > 0) {
                    try {
                        errBody = JSON.parse(errorText);
                    } catch {
                        errBody = { raw: errorText };
                    }
                } else {
                    errBody = { raw: '(empty response body)' };
                }
            } catch (e) {
                errBody = { error: 'Failed to read error response', details: String(e) };
            }
            console.error('[useProposeSafeTransaction] Safe API error response:', {
                status: proposeRes.status,
                statusText: proposeRes.statusText,
                body: errBody,
            });
            throw new Error(
                (typeof errBody.message === 'string' && errBody.message) ||
                (Array.isArray(errBody.nonFieldErrors) ? errBody.nonFieldErrors.join(', ') : undefined) ||
                (typeof errBody.detail === 'object' && errBody.detail !== null && typeof (errBody.detail as { message?: string }).message === 'string' ? (errBody.detail as { message?: string }).message : undefined) ||
                (typeof errBody.raw === 'string' && errBody.raw) ||
                (typeof errBody.error === 'string' && errBody.error) ||
                `Lỗi khi đề xuất Safe transaction: ${proposeRes.status} ${proposeRes.statusText}`
            );
        }

        // Parse response - Safe API may return 201 with JSON or 200/204 with empty body
        let result: { safeTxHash?: string; transactionHash?: string } = {};
        try {
            const text = await proposeRes.text();
            console.log('[useProposeSafeTransaction] Response status:', proposeRes.status);
            console.log('[useProposeSafeTransaction] Response headers:', Object.fromEntries(proposeRes.headers.entries()));
            console.log('[useProposeSafeTransaction] Response body:', text);
            if (text && text.length > 0) {
                try {
                    result = JSON.parse(text);
                } catch (parseError) {
                    console.log('[useProposeSafeTransaction] Response is not JSON:', parseError);
                    // Some Safe API deployments may return empty body on success
                    result = { safeTxHash: safeTxHash };
                }
            } else {
                console.log('[useProposeSafeTransaction] Empty response body, using safeTxHash from request');
                result = { safeTxHash: safeTxHash };
            }
        } catch (error) {
            console.error('[useProposeSafeTransaction] Failed to read response:', error);
            result = { safeTxHash: safeTxHash };
        }

        const returnedSafeTxHash = result.safeTxHash || result.transactionHash || safeTxHash;

        // 9. Return success info
        return {
            safeTxHash: returnedSafeTxHash,
            safeUiUrl: `https://app.safe.global/sep:${checksumSafe}/transactions/queue`,
            message: `Đã đề xuất phê duyệt. Cần thêm ${threshold - 1} chữ ký nữa để thực thi.`,
        };
    };

    return { propose };
}

// ABI for Safe's execTransaction function
const SAFE_EXEC_ABI = [
    {
        type: "function",
        name: "execTransaction",
        stateMutability: "payable",
        inputs: [
            { name: "to", type: "address" },
            { name: "value", type: "uint256" },
            { name: "data", type: "bytes" },
            { name: "operation", type: "uint8" },
            { name: "safeTxGas", type: "uint256" },
            { name: "baseGas", type: "uint256" },
            { name: "gasPrice", type: "uint256" },
            { name: "gasToken", type: "address" },
            { name: "refundReceiver", type: "address" },
            { name: "signatures", type: "bytes" },
        ],
        outputs: [{ name: "success", type: "bool" }],
    },
] as const;

interface SafeConfirmation {
    owner: string;
    signature: string;
}

interface SafeTransaction {
    safeTxHash?: string;
    transactionHash?: string;
    to: string;
    value: string;
    data: string;
    operation: number;
    safeTxGas: string;
    baseGas: string;
    gasPrice: string;
    gasToken?: string;
    refundReceiver?: string;
    confirmations: SafeConfirmation[];
    confirmationsRequired?: number;
    confirmations_required?: number;
    isExecuted?: boolean;
    executed?: boolean;
}

/**
 * Hook for executing Safe multisig transactions directly from the app
 */
export function useExecuteSafeTransaction() {
    const { address } = useAccount();
    const publicClient = usePublicClient();
    const { writeContractAsync, data, isPending, error } = useWriteContract();

    const execute = async (
        safeAddress: Address,
        safeTxHash: string
    ): Promise<`0x${string}`> => {
        if (!publicClient) {
            throw new Error("Không thể kết nối RPC để ước lượng gas.");
        }
        if (!address) {
            throw new Error("Không tìm thấy địa chỉ ví để gửi giao dịch.");
        }

        // Validate safeAddress first
        const normalizedSafeAddress = (safeAddress || "").trim().toLowerCase();
        if (!/^0x[a-f0-9]{40}$/.test(normalizedSafeAddress)) {
            throw new Error(`Invalid Safe address: "${safeAddress}". Expected a valid EVM address (0x + 40 hex chars).`);
        }
        const checksumSafe = getAddress(normalizedSafeAddress as Address);

        // 1. Fetch pending transactions for the Safe from Safe Transaction Service
        const safeApiUrl = `https://safe-transaction-sepolia.safe.global/api/v1/safes/${checksumSafe}/multisig-transactions/?executed=false&ordering=-nonce`;
        const response = await fetch(safeApiUrl, { cache: "no-store" });
        if (!response.ok) {
            throw new Error(
                `Không thể lấy danh sách pending transactions từ Safe API: ${response.status}`
            );
        }
        const payload = await response.json();
        const results = Array.isArray(payload?.results) ? payload.results : [];

        // 2. Find the specific transaction by safeTxHash
        const tx = results.find(
            (t: SafeTransaction) => (t.safeTxHash || t.transactionHash) === safeTxHash
        );
        if (!tx) {
            throw new Error(
                `Không tìm thấy pending transaction với hash ${safeTxHash}. Có thể đã được execute hoặc bị xóa.`
            );
        }

        // 3. Validate threshold reached
        const confirmations = Array.isArray(tx.confirmations)
            ? tx.confirmations
            : [];
        const required = Number(
            tx.confirmationsRequired || tx.confirmations_required || 0
        );
        const confirmed = confirmations.length;

        if (confirmed < required) {
            throw new Error(
                `Chưa đủ chữ ký để thực thi. Cần ${required}, đã có ${confirmed}.`
            );
        }

        // 4. Check not already executed
        const isExecuted = Boolean(tx.isExecuted ?? tx.executed ?? false);
        if (isExecuted) {
            throw new Error("Giao dịch này đã được thực thi trước đó.");
        }

        // 5. Extract transaction parameters
        const {
            to,
            value,
            data: txData,
            operation,
            safeTxGas,
            baseGas,
            gasPrice,
            gasToken,
            refundReceiver,
        } = tx;

        if (!to || !txData) {
            throw new Error("Dữ liệu transaction không hợp lệ từ Safe API.");
        }

        // 6. Sort confirmations by owner address (ascending) - MANDATORY for Safe
        const sortedConfirmations = [...confirmations].sort((a, b) =>
            a.owner.toLowerCase().localeCompare(b.owner.toLowerCase())
        );

        // 7. Concatenate signatures into single bytes string
        // Each signature is hex string like "0x..."
        const signatures: `0x${string}` =
            "0x" +
            sortedConfirmations
                .map((c) => c.signature.slice(2)) // remove 0x prefix
                .join("") as `0x${string}`;

        // 8. Build args for execTransaction
        const args: [
            to: Address,
            value: bigint,
            data: `0x${string}`,
            operation: number,
            safeTxGas: bigint,
            baseGas: bigint,
            gasPrice: bigint,
            gasToken: Address,
            refundReceiver: Address,
            signatures: `0x${string}`
        ] = [
                to as Address,
                BigInt(value || 0),
                txData as `0x${string}`,
                Number(operation || 0),
                BigInt(safeTxGas || 0),
                BigInt(baseGas || 0),
                BigInt(gasPrice || 0),
                (gasToken || "0x0000000000000000000000000000000000000000") as Address,
                (refundReceiver || "0x0000000000000000000000000000000000000000") as Address,
                signatures,
            ];

        // 9. Simulate contract call to validate and estimate gas
        let estimatedGas: bigint;
        try {
            await publicClient.simulateContract({
                address: checksumSafe,
                abi: SAFE_EXEC_ABI,
                functionName: "execTransaction",
                args,
                account: address,
            });
            // simulation may return gasEstimate in some implementations
            // but viem's simulateContract doesn't return it directly
        } catch (simulationError) {
            const message =
                simulationError instanceof Error
                    ? simulationError.message.toLowerCase()
                    : "";
            if (message.includes("gas limit too high")) {
                // Continue with fallback gas
            } else if (message.includes("already executed")) {
                throw new Error("Giao dịch đã được thực thi trước đó.");
            } else if (message.includes("invalid signature")) {
                throw new Error(
                    "Chữ ký không hợp lệ. Có thể do Safe contract không khớp."
                );
            } else {
                throw simulationError;
            }
        }

        // 10. Estimate gas with buffer
        try {
            const gasEstimate = await publicClient.estimateContractGas({
                address: checksumSafe,
                abi: SAFE_EXEC_ABI,
                functionName: "execTransaction",
                args,
                account: address,
            });
            estimatedGas = (gasEstimate * 120n) / 100n; // 20% buffer
        } catch (estimateError) {
            // Use safe fallback if estimation fails
            console.warn(
                "[useExecuteSafeTransaction] Gas estimation failed, using fallback",
                estimateError
            );
            estimatedGas = 2_000_000n;
        }

        // 11. Execute transaction on-chain
        const hash = await writeContractAsync({
            address: checksumSafe,
            abi: SAFE_EXEC_ABI,
            functionName: "execTransaction",
            args,
            gas: estimatedGas,
            value: 0n, // Safe execTransaction is payable, but we send 0 ETH
        });

        return hash as `0x${string}`;
    };

    return {
        execute,
        hash: data,
        isPending,
        error,
    };
}
