"use client";

import {
    contractConfig,
    createTransaction,
    getCampaignMetadataFromCache,
    getDonationsByCampaign,
    getDonationsByCampaignAndWallet,
    getPublicStats,
    getRefundStatus,
    isPlaceholderCampaignDescription,
    isPlaceholderCampaignTitle,
    toAuthUserProfile,
    updateUserProfile,
    useAuth,
    useBackendCampaign,
    useClaimFundingRefund,
    useClaimMilestoneRefund,
    useDisburseMilestone,
    useDonateToCampaign,
    useMarkAsFailed,
    useMarkMilestoneFailed,
    useMintCertificate,
    useReadCampaign,
} from "@/lib";
import {
    getChainErrorMessage,
    getWalletErrorMessage,
    isWalletUserRejectedMessage,
} from "@/lib/errors/normalize";
import { showErrorToast, showSuccessToast } from "@/lib/ui/toast";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatEther, parseAbiItem, parseEther } from "viem";
import {
    useAccount,
    usePublicClient,
    useReadContract,
    useWaitForTransactionReceipt,
    useWatchContractEvent,
} from "wagmi";
import CampaignInfoPanel from "@/components/campaign-detail/CampaignInfoPanel";
import { MilestonePreviewCard } from "@/components/campaign-milestones";
import DonatePanel from "@/components/campaign-detail/DonatePanel";
import RefundAndMintPanel from "@/components/campaign-detail/RefundAndMintPanel";
import BackButton from "@/components/navigation/BackButton";
import { useRegisterWalletTxOverlay } from "@/context/wallet-tx-overlay";

interface DonationEvent {
    campaignId: number;
    donor: string;
    amount: bigint;
    transactionHash: string;
    timestamp: number;
}

export default function CampaignDetailPage() {
    const params = useParams();
    const { address, isConnected, chain } = useAccount();
    const [hasMounted, setHasMounted] = useState(false);
    useEffect(() => {
        setHasMounted(true);
    }, []);
    const id = Number(params?.id);
    const { campaign, isLoading, isError, error, refetch } = useReadCampaign(
        Number.isFinite(id) ? id : null,
    );
    const backendCampaign = useBackendCampaign(Number.isFinite(id) ? id : null);
    const { token, user, setAuth } = useAuth();
    const [amount, setAmount] = useState("0.01");
    const [refundStatus, setRefundStatus] = useState<{
        status: "none" | "eligible" | "prepared" | "refunded";
        refundedWei: string;
    } | null>(null);
    const [lastDonatedAmount, setLastDonatedAmount] = useState<string | null>(
        null,
    );
    const [donations, setDonations] = useState<DonationEvent[]>([]);
    const [isDonationHistoryLoading, setIsDonationHistoryLoading] =
        useState(false);
    const [mintProfileSaving, setMintProfileSaving] = useState(false);
    const [mintFlowError, setMintFlowError] = useState<string | null>(null);
    const publicClient = usePublicClient({ chainId: contractConfig.chainId });
    const [donationHistoryWarning, setDonationHistoryWarning] = useState<
        string | null
    >(null);
    const lastDonationSuccessTxRef = useRef<string | null>(null);
    const lastDisburseSuccessTxRef = useRef<string | null>(null);
    const lastRefundSuccessTxRef = useRef<string | null>(null);
    const lastMarkAsFailedSuccessTxRef = useRef<string | null>(null);
    const {
        donate,
        hash,
        isPending,
        error: donateError,
    } = useDonateToCampaign();
    const {
        disburseMilestone,
        hash: disburseHash,
        isPending: disbursePending,
        error: disburseError,
    } = useDisburseMilestone();
    const {
        claimFundingRefund,
        hash: fundingRefundHash,
        isPending: fundingRefundPending,
        error: fundingRefundError,
    } = useClaimFundingRefund();
    const {
        claimMilestoneRefund,
        hash: milestoneRefundHash,
        isPending: milestoneRefundPending,
        error: milestoneRefundError,
    } = useClaimMilestoneRefund();
    const {
        markAsFailed,
        hash: markAsFailedHash,
        isPending: markAsFailedPending,
        error: markAsFailedError,
    } = useMarkAsFailed();
    const {
        markMilestoneFailed,
        hash: milestoneFailedHash,
        isPending: milestoneFailedPending,
        error: milestoneFailedError,
    } = useMarkMilestoneFailed();
    const {
        mintCertificate,
        hash: mintHash,
        isPending: mintPending,
        error: mintError,
    } = useMintCertificate();

    const { isLoading: isConfirming, isSuccess: isConfirmed } =
        useWaitForTransactionReceipt({
            hash,
        });

    const { isLoading: disburseConfirming, isSuccess: disburseConfirmed } =
        useWaitForTransactionReceipt({
            hash: disburseHash,
        });

    const { isLoading: refundConfirming, isSuccess: refundConfirmed } =
        useWaitForTransactionReceipt({
            hash: milestoneRefundHash || fundingRefundHash,
        });

    const { isLoading: mintConfirming, isSuccess: mintConfirmed } =
        useWaitForTransactionReceipt({
            hash: mintHash,
        });
    const {
        isLoading: markAsFailedConfirming,
        isSuccess: markAsFailedConfirmed,
    } = useWaitForTransactionReceipt({
        hash: markAsFailedHash,
    });
    useRegisterWalletTxOverlay(
        isPending ||
            isConfirming ||
            disbursePending ||
            disburseConfirming ||
            fundingRefundPending ||
            milestoneRefundPending ||
            refundConfirming ||
            mintPending ||
            mintConfirming ||
            markAsFailedPending ||
            markAsFailedConfirming ||
            milestoneFailedPending,
    );

    const { data: hasMintedCertificate } = useReadContract({
        ...contractConfig,
        functionName: "hasMintedCertificate",
        args:
            Number.isFinite(id) && address ? [BigInt(id), address] : undefined,
        query: { enabled: Number.isFinite(id) && !!address },
    });
    const { data: donatedAmountOnChain } = useReadContract({
        ...contractConfig,
        functionName: "getDonation",
        args:
            Number.isFinite(id) && address ? [BigInt(id), address] : undefined,
        query: { enabled: Number.isFinite(id) && !!address },
    });

    const mergeDonations = (
        current: DonationEvent[],
        incoming: DonationEvent[],
    ) => {
        const byTxHash = new Map<string, DonationEvent>();
        [...current, ...incoming].forEach((item) => {
            if (!item.transactionHash) return;
            const key = item.transactionHash.toLowerCase();
            const existed = byTxHash.get(key);

            // Prefer newer timestamp data when same tx appears from multiple sources.
            if (!existed || item.timestamp > existed.timestamp) {
                byTxHash.set(key, item);
            }
        });

        return Array.from(byTxHash.values()).sort(
            (a, b) => b.timestamp - a.timestamp,
        );
    };

    const loadDonationHistory = useCallback(async () => {
        if (!Number.isFinite(id)) return;
        setIsDonationHistoryLoading(true);
        try {
            const merged: DonationEvent[] = [];
            let hasAtLeastOneSource = false;

            try {
                const backendDonations = await getDonationsByCampaign(id);
                merged.push(
                    ...backendDonations.map((item) => ({
                        campaignId: item.campaignOnChainId,
                        donor: item.donorWallet,
                        amount: BigInt(item.amount),
                        transactionHash: item.txHash,
                        timestamp: new Date(item.donatedAt).getTime(),
                    })),
                );
                hasAtLeastOneSource = true;
            } catch {
                // Backend can lag behind indexer; keep loading from on-chain logs.
            }
            if (address) {
                try {
                    const mine = await getDonationsByCampaignAndWallet(
                        id,
                        address,
                    );
                    merged.push(
                        ...mine.map((item) => ({
                            campaignId: item.campaignOnChainId,
                            donor: item.donorWallet,
                            amount: BigInt(item.amount),
                            transactionHash: item.txHash,
                            timestamp: new Date(item.donatedAt).getTime(),
                        })),
                    );
                    hasAtLeastOneSource = true;
                } catch {
                    // Keep all-campaign snapshot if donor scoped query fails.
                }
            }

            if (publicClient) {
                try {
                    const donatedEvent = parseAbiItem(
                        "event Donated(uint256 indexed campaignId, address indexed donor, uint256 amount, uint256 totalRaised)",
                    );
                    const latestBlock = await publicClient.getBlockNumber();
                    // Alchemy Free tier giới hạn 10 block/request → dùng chunk 9 block
                    const maxBlocksToScan = 1000n;
                    const chunkSize = 9n;
                    const fromBlock =
                        latestBlock > maxBlocksToScan
                            ? latestBlock - maxBlocksToScan + 1n
                            : 0n;
                    const logs: Awaited<
                        ReturnType<typeof publicClient.getLogs>
                    > = [];

                    for (
                        let chunkFrom = fromBlock;
                        chunkFrom <= latestBlock;
                        chunkFrom += chunkSize
                    ) {
                        const chunkTo =
                            chunkFrom + chunkSize - 1n > latestBlock
                                ? latestBlock
                                : chunkFrom + chunkSize - 1n;
                        try {
                            const chunkLogs = await publicClient.getLogs({
                                address: contractConfig.address,
                                event: donatedEvent,
                                args: { campaignId: BigInt(id) },
                                fromBlock: chunkFrom,
                                toBlock: chunkTo,
                            });
                            if (chunkLogs.length > 0) {
                                logs.push(...chunkLogs);
                            }
                        } catch {
                            // Bỏ qua chunk lỗi (rate-limit / RPC tạm thời), tiếp tục các chunk còn lại
                        }
                    }

                    const onChainDonations = await Promise.all(
                        logs.map(async (log) => {
                            const args = (
                                log as {
                                    args?: {
                                        campaignId?: bigint;
                                        donor?: string;
                                        amount?: bigint;
                                    };
                                }
                            ).args;
                            return {
                                campaignId: Number(
                                    args?.campaignId ?? BigInt(id),
                                ),
                                donor: args?.donor ?? "",
                                amount: args?.amount ?? BigInt(0),
                                transactionHash: log.transactionHash ?? "",
                                // Avoid extra per-log RPC calls (getBlock) to prevent list being empty on flaky RPC.
                                timestamp: Date.now(),
                            } satisfies DonationEvent;
                        }),
                    );

                    merged.push(...onChainDonations);
                    hasAtLeastOneSource = true;
                } catch {
                    // Keep backend snapshot if on-chain lookup fails.
                }
            }

            setDonations((prev) => mergeDonations(prev, merged));
            setDonationHistoryWarning(
                hasAtLeastOneSource
                    ? null
                    : "Không thể tải lịch sử quyên góp từ backend/on-chain. Vui lòng thử lại sau.",
            );
        } catch {
            setDonationHistoryWarning(
                "Không thể tải lịch sử quyên góp từ backend/on-chain. Vui lòng thử lại sau.",
            );
        } finally {
            setIsDonationHistoryLoading(false);
        }
    }, [address, id, publicClient]);

    useEffect(() => {
        setDonations([]);
        setDonationHistoryWarning(null);
        loadDonationHistory();
    }, [loadDonationHistory]);

    const fetchRefundStatus = useCallback(async () => {
        if (!Number.isFinite(id) || !address) {
            setRefundStatus(null);
            return;
        }
        try {
            const data = await getRefundStatus(id, address);
            setRefundStatus(data);
        } catch (err) {
            console.error("Failed to fetch refund status:", err);
        }
    }, [id, address]);

    useEffect(() => {
        fetchRefundStatus();
    }, [fetchRefundStatus]);

    useEffect(() => {
        if (!campaign || !Number.isFinite(id)) return;
        // Trigger an additional fetch when campaign data is ready to avoid
        // missing initial history in slower RPC/backend startup.
        loadDonationHistory();
    }, [campaign, id, loadDonationHistory]);

    // Check if user is creator
    const isCreator =
        address &&
        campaign &&
        address.toLowerCase() === campaign.creator.toLowerCase();

    const backendStatus = backendCampaign.data?.status as
        | "pending_approval"
        | "active"
        | "in_progress"
        | "completed"
        | "partial_failed"
        | "failed"
        | "cancelled"
        | undefined;
    const onChainStatusLabel = campaign?.statusLabel || "active";
    // Ưu tiên trạng thái từ backend nếu có (vì backend xử lý logic timeout/failed chuẩn hơn)
    const campaignStatusLabel = backendStatus || onChainStatusLabel;
    const isStatusOutOfSync =
        Boolean(backendStatus) && backendStatus !== onChainStatusLabel;
    const isCampaignActive = campaignStatusLabel === "active";
    const isCampaignInProgress = campaignStatusLabel === "in_progress";
    const isCampaignCompleted = campaignStatusLabel === "completed";
    const isCampaignPartialFailed = campaignStatusLabel === "partial_failed";
    const isCampaignFailed = campaignStatusLabel === "failed";
    const isCampaignCancelled = campaignStatusLabel === "cancelled";
    const canMintCertificate =
        isCampaignInProgress || isCampaignCompleted || isCampaignPartialFailed;
    const canDisburseCurrentMilestone = Boolean(
        campaign &&
        isCampaignInProgress &&
        campaign.currentMilestoneId < campaign.milestoneCount,
    );
    const shouldMarkAsFailed = Boolean(
        campaign &&
        isCampaignActive &&
        campaign.raised < campaign.goal &&
        campaign.deadline > 0 &&
        Math.floor(Date.now() / 1000) >= campaign.deadline,
    );

    const { data: currentMilestoneData } = useReadContract({
        ...contractConfig,
        functionName: "getMilestone",
        args:
            campaign && Number.isFinite(id)
                ? [BigInt(id), BigInt(campaign.currentMilestoneId)]
                : undefined,
        query: { enabled: !!campaign && Number.isFinite(id) },
    });

    const isCurrentMilestoneExpired = useMemo(() => {
        if (!campaign || !isCampaignInProgress || !currentMilestoneData)
            return false;

        // Ưu tiên lấy deadline từ backend nếu có (đã được gia hạn 3 ngày)
        // Lưu ý: campaign.milestones thường được load từ backend thông qua useReadCampaign
        // hoặc chúng ta có thể lấy từ backendCampaign hook.

        const mOnChain = currentMilestoneData as any;
        let deadline = Number(mOnChain?.deadline ?? mOnChain?.[2] ?? 0);

        // Tìm milestone tương ứng trong dữ liệu backend (nếu có)
        if (backendCampaign.data?.milestones) {
            const mBackend = backendCampaign.data.milestones.find(
                (mb: any) =>
                    Number(mb.milestoneId) ===
                    Number(campaign.currentMilestoneId),
            );
            if (mBackend && mBackend.deadline) {
                deadline = Math.floor(
                    new Date(mBackend.deadline).getTime() / 1000,
                );
            }
        }

        if (deadline === 0) return false;
        const now = Math.floor(Date.now() / 1000);
        return now > deadline;
    }, [
        campaign,
        isCampaignInProgress,
        currentMilestoneData,
        backendCampaign.data,
    ]);

    const shouldMarkMilestoneAsFailed = Boolean(
        isCampaignInProgress &&
        isCurrentMilestoneExpired &&
        !isCampaignPartialFailed,
    );

    // Compute total donated by current user in this campaign.
    const userDonatedAmount = useMemo(() => {
        if (!address) return BigInt(0);
        return donations
            .filter((d) => d.donor.toLowerCase() === address.toLowerCase())
            .reduce((sum, d) => sum + d.amount, BigInt(0));
    }, [address, donations]);
    const topDonors = useMemo(() => {
        const byDonor = new Map<string, bigint>();
        donations.forEach((d) => {
            if (!d.donor) return;
            const key = d.donor.toLowerCase();
            const current = byDonor.get(key) ?? 0n;
            byDonor.set(key, current + d.amount);
        });
        return Array.from(byDonor.entries())
            .map(([donor, totalAmount]) => ({ donor, totalAmount }))
            .sort((a, b) => (b.totalAmount > a.totalAmount ? 1 : -1))
            .slice(0, 5);
    }, [donations]);
    const effectiveUserDonatedAmount = useMemo(() => {
        const onChain = (donatedAmountOnChain as bigint | undefined) ?? 0n;
        // Nếu campaign đã thất bại hoặc thất bại một phần (đã qua giai đoạn donate),
        // trust blockchain hoàn toàn để xử lý việc đã rút tiền (refund)
        if (isCampaignFailed || isCampaignPartialFailed) {
            return onChain;
        }
        return onChain > userDonatedAmount ? onChain : userDonatedAmount;
    }, [
        donatedAmountOnChain,
        userDonatedAmount,
        isCampaignFailed,
        isCampaignPartialFailed,
    ]);

    // Watch for donation events
    useWatchContractEvent({
        ...contractConfig,
        eventName: "Donated",
        onLogs: (logs) => {
            const newDonations = logs
                .map((log) => {
                    const args = (
                        log as {
                            args?: {
                                campaignId?: bigint;
                                donor?: string;
                                amount?: bigint;
                            };
                        }
                    ).args;
                    return {
                        campaignId: Number(args?.campaignId || 0),
                        donor: args?.donor || "",
                        amount: args?.amount || BigInt(0),
                        transactionHash: log.transactionHash || "",
                        timestamp: Date.now(),
                    };
                })
                .filter((item) => item.campaignId === id);

            setDonations((prev) => mergeDonations(prev, newDonations));
            refetch();
        },
    });

    // Watch for FundingComplete: campaign đủ vốn → cập nhật trạng thái ngay lập tức
    useWatchContractEvent({
        ...contractConfig,
        eventName: "FundingComplete",
        onLogs: (logs) => {
            const relevant = logs.some(
                (log) =>
                    Number(
                        (log as { args?: { campaignId?: bigint } }).args
                            ?.campaignId ?? 0n,
                    ) === id,
            );
            if (!relevant) return;
            // On-chain đã confirm đủ vốn → refetch on-chain data ngay
            refetch();
            // Backend listener cần vài giây để index FundingComplete → poll 3 lần × 4s
            let attempts = 0;
            const timer = window.setInterval(() => {
                attempts += 1;
                backendCampaign.refetch();
                if (attempts >= 3) window.clearInterval(timer);
            }, 4_000);
        },
    });

    // Watch for CampaignApproved: admin duyệt campaign → cập nhật trạng thái ngay
    useWatchContractEvent({
        ...contractConfig,
        eventName: "CampaignApproved",
        onLogs: (logs) => {
            const relevant = logs.some(
                (log) =>
                    Number(
                        (log as { args?: { campaignId?: bigint } }).args
                            ?.campaignId ?? 0n,
                    ) === id,
            );
            if (!relevant) return;
            refetch();
            let attempts = 0;
            const timer = window.setInterval(() => {
                attempts += 1;
                backendCampaign.refetch();
                if (attempts >= 3) window.clearInterval(timer);
            }, 4_000);
        },
    });

    const getFriendlyError = (err?: { message?: string } | null) => {
        if (!err) return null;
        return getChainErrorMessage(err, {
            fallback: "Giao dịch thất bại. Vui lòng thử lại.",
        });
    };

    useEffect(() => {
        if (!isError) return;

        // Vừa tạo campaign xong có thể bị "out of range" tạm thời do hook count
        // chưa cập nhật kịp. Trường hợp này không nên hiện lỗi màu đỏ/toast,
        // mà nên hiển thị trạng thái chờ và tự refetch.
        const isWaitingForOnChainUpdate =
            typeof error === "string" &&
            error.toLowerCase().includes("does not exist on-chain");

        if (isWaitingForOnChainUpdate) return;

        const friendly = getChainErrorMessage(error, {
            fallback: "Không thể tải chiến dịch.",
        });
        showErrorToast(friendly, {
            emphasis: !isWalletUserRejectedMessage(friendly),
        });
    }, [error, isError]);

    useEffect(() => {
        const isWaitingForOnChainUpdate =
            typeof error === "string" &&
            error.toLowerCase().includes("does not exist on-chain");
        if (!isError || !isWaitingForOnChainUpdate) return;

        const timer = window.setInterval(() => {
            refetch();
        }, 3_000);

        return () => window.clearInterval(timer);
    }, [error, isError, refetch]);

    useEffect(() => {
        const friendly = getFriendlyError(markAsFailedError);
        if (!friendly) return;
        showErrorToast(friendly, {
            emphasis: !isWalletUserRejectedMessage(friendly),
        });
    }, [markAsFailedError]);

    useEffect(() => {
        const friendly = getFriendlyError(milestoneFailedError);
        if (!friendly) return;
        showErrorToast(friendly, {
            emphasis: !isWalletUserRejectedMessage(friendly),
        });
    }, [milestoneFailedError]);

    useEffect(() => {
        const friendly = getWalletErrorMessage(disburseError, {
            fallback:
                "Không thể giải ngân milestone hiện tại. Vui lòng thử lại.",
        });
        if (!disburseError || !friendly) return;
        showErrorToast(friendly, {
            emphasis: !isWalletUserRejectedMessage(friendly),
        });
    }, [disburseError]);

    useEffect(() => {
        const rawError = isCampaignPartialFailed
            ? milestoneRefundError
            : fundingRefundError;
        const friendly = getWalletErrorMessage(rawError, {
            fallback: "Không thể hoàn tiền. Vui lòng thử lại.",
        });
        if (!rawError || !friendly) return;
        showErrorToast(friendly, {
            emphasis: !isWalletUserRejectedMessage(friendly),
        });
    }, [fundingRefundError, isCampaignPartialFailed, milestoneRefundError]);

    useEffect(() => {
        if (!mintFlowError && !mintError) return; // ← thêm dòng này

        const friendly = getWalletErrorMessage(mintFlowError || mintError, {
            fallback: "Không thể mint chứng chỉ. Vui lòng thử lại.",
        });
        if (!friendly) return;
        showErrorToast(friendly, {
            emphasis: !isWalletUserRejectedMessage(friendly),
        });
    }, [mintError, mintFlowError]);

    useEffect(() => {
        if (isConfirmed && hash && lastDonationSuccessTxRef.current !== hash) {
            lastDonationSuccessTxRef.current = hash;
            if (hash && address && lastDonatedAmount) {
                try {
                    setDonations((prev) =>
                        mergeDonations(prev, [
                            {
                                campaignId: id,
                                donor: address,
                                amount: parseEther(lastDonatedAmount),
                                transactionHash: hash,
                                timestamp: Date.now(),
                            },
                        ]),
                    );
                } catch {
                    // Ignore malformed local amount and keep server/on-chain data sources.
                }
            }
            refetch();
            setAmount("0.01");
            setLastDonatedAmount(null);
        }
    }, [address, hash, id, isConfirmed, lastDonatedAmount, refetch]);

    // Sau khi donation được confirm on-chain, poll backend vài lần để bắt kịp
    // trạng thái in_progress (backend cần ~3-5s để xử lý FundingComplete event)
    useEffect(() => {
        if (!isConfirmed || !hash || lastDonationSuccessTxRef.current !== hash) return;
        let attempts = 0;
        const timer = window.setInterval(() => {
            attempts += 1;
            backendCampaign.refetch();
            if (attempts >= 4) window.clearInterval(timer);
        }, 3_000);
        return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isConfirmed, hash]);

    const handleDonate = () => {
        if (!Number.isFinite(id)) return;
        if (parseFloat(amount) <= 0) return;

        // Kiểm tra số tiền donate không vượt quá remaining goal
        if (campaign) {
            const goalWei = campaign.goal;
            const raisedWei = campaign.raised;
            const remainingWei = goalWei - raisedWei;
            const amountWei = parseEther(amount);

            if (amountWei > remainingWei) {
                showErrorToast(
                    `Số tiền quyên góp vượt quá mục tiêu còn lại. Tối đa: ${formatEther(remainingWei)} ETH`
                );
                return;
            }
        }

        setLastDonatedAmount(amount);
        donate(id, amount).catch((err) => {
            setLastDonatedAmount(null);
            const friendly = getFriendlyError(err);
            showErrorToast(
                friendly || "Không thể thực hiện quyên góp. Vui lòng thử lại.",
            );
        });
    };

    const handleWithdraw = async () => {
        if (!Number.isFinite(id)) return;
        if (!campaign) return;
        try {
            await disburseMilestone(id, campaign.currentMilestoneId);
        } catch (err) {
            const friendly = getFriendlyError(err as { message?: string });
            showErrorToast(
                friendly ||
                    "Không thể giải ngân milestone hiện tại. Vui lòng thử lại.",
            );
        }
    };

    const handleRefund = () => {
        if (!Number.isFinite(id)) return;
        if (!campaign) return;
        try {
            if (isCampaignPartialFailed) {
                claimMilestoneRefund(id, campaign.currentMilestoneId);
            } else {
                claimFundingRefund(id);
            }
        } catch (err) {
            const friendly = getFriendlyError(err as { message?: string });
            showErrorToast(
                friendly || "Không thể hoàn tiền. Vui lòng thử lại.",
            );
        }
    };

    const handleMintCertificate = async (displayName: string) => {
        if (!Number.isFinite(id)) return;
        if (!address) {
            setMintFlowError("Vui lòng kết nối ví trước khi mint chứng chỉ.");
            return;
        }
        if (!canMintCertificate) {
            setMintFlowError(
                "Chưa thể mint chứng chỉ. Chỉ mint được khi campaign đã vào giai đoạn triển khai hoặc đã kết thúc.",
            );
            return;
        }
        if (!token) {
            setMintFlowError(
                "Bạn cần đăng nhập lại để cập nhật tên hiển thị trước khi mint.",
            );
            return;
        }

        const normalizedName = displayName.trim();
        if (!normalizedName) {
            setMintFlowError("Tên hiển thị không được để trống.");
            return;
        }

        setMintFlowError(null);
        setMintProfileSaving(true);
        try {
            const updated = await updateUserProfile(token, address, {
                displayName: normalizedName,
                avatarUrl: user?.avatarUrl || "",
            });
            setAuth(token, toAuthUserProfile(updated));
            await mintCertificate(id);
        } catch (err) {
            const message = getWalletErrorMessage(err, {
                fallback: "Không thể cập nhật tên hiển thị trước khi mint.",
            });
            setMintFlowError(message);
        } finally {
            setMintProfileSaving(false);
        }
    };
    const handleReloadDonations = () => {
        loadDonationHistory();
    };
    const handleMarkAsFailed = () => {
        if (!Number.isFinite(id)) return;
        try {
            markAsFailed(id);
        } catch (err) {
            const friendly = getFriendlyError(err as { message?: string });
            showErrorToast(
                friendly ||
                    "Không thể cập nhật trạng thái thất bại. Vui lòng thử lại.",
            );
        }
    };

    const handleMarkMilestoneAsFailed = () => {
        if (!Number.isFinite(id) || !campaign) return;
        try {
            markMilestoneFailed(id, campaign.currentMilestoneId);
        } catch (err) {
            const friendly = getFriendlyError(err as { message?: string });
            showErrorToast(
                friendly ||
                    "Không thể cập nhật trạng thái thất bại của milestone. Vui lòng thử lại.",
            );
        }
    };

    useEffect(() => {
        if (
            markAsFailedConfirmed &&
            markAsFailedHash &&
            lastMarkAsFailedSuccessTxRef.current !== markAsFailedHash
        ) {
            lastMarkAsFailedSuccessTxRef.current = markAsFailedHash;
            refetch();
            showSuccessToast("Đã cập nhật campaign sang trạng thái thất bại.");
        }
    }, [markAsFailedConfirmed, markAsFailedHash, refetch]);

    const {
        isLoading: milestoneFailedConfirming,
        isSuccess: milestoneFailedConfirmed,
    } = useWaitForTransactionReceipt({
        hash: milestoneFailedHash,
    });

    useEffect(() => {
        if (milestoneFailedConfirmed) {
            refetch();
            showSuccessToast("Đã cập nhật mốc thất bại trên Blockchain.");
        }
    }, [milestoneFailedConfirmed, refetch]);

    useEffect(() => {
        if (
            !disburseConfirmed ||
            !disburseHash ||
            lastDisburseSuccessTxRef.current === disburseHash
        )
            return;
        lastDisburseSuccessTxRef.current = disburseHash;
        refetch();
        showSuccessToast("Giải ngân milestone thành công.");
    }, [disburseConfirmed, disburseHash, refetch]);

    useEffect(() => {
        const refundTxHash = milestoneRefundHash || fundingRefundHash;
        if (
            !refundConfirmed ||
            !refundTxHash ||
            lastRefundSuccessTxRef.current === refundTxHash
        )
            return;
        lastRefundSuccessTxRef.current = refundTxHash;
        refetch();
        fetchRefundStatus();
        showSuccessToast("Hoàn tiền thành công.");
    }, [
        fundingRefundHash,
        milestoneRefundHash,
        refundConfirmed,
        refetch,
        fetchRefundStatus,
    ]);

    useEffect(() => {
        const txHash = mintHash || hash;
        if (!txHash || !address) return;

        const action = mintHash ? "mintNFT" : "donate";

        createTransaction(token, {
            txHash,
            walletAddress: address,
            action,
            campaignOnChainId: Number.isFinite(id) ? id : undefined,
        }).catch(() => {
            // Keep UI responsive even when transaction logging fails.
        });
    }, [address, hash, id, mintHash, token]);

    const progress = useMemo(() => {
        if (!campaign) return 0;
        const goalEth = Number(formatEther(campaign.goal));
        const raisedEth = Number(formatEther(campaign.raised));
        return goalEth > 0 ? Math.min((raisedEth / goalEth) * 100, 100) : 0;
    }, [campaign]);

    const isSepolia = chain?.id === 11155111;
    const canDonate = Boolean(
        isConnected && isSepolia && campaign && isCampaignActive,
    );
    const cachedMetadata = useMemo(
        () => (Number.isFinite(id) ? getCampaignMetadataFromCache(id) : null),
        [id],
    );

    return (
        <div className="min-h-screen bg-linear-to-b from-slate-50 to-white text-slate-900">
            <main className="mx-auto w-full max-w-6xl px-6 py-12 md:px-10">
                {/* Page Header */}
                <header className="flex flex-col gap-4 mb-8">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <BackButton
                                fallbackHref="/campaigns"
                                preferFallback
                            />
                            <div>
                                <div className="inline-flex items-center gap-2 mb-1">
                                    <span className="text-xs font-semibold text-blue-600 bg-blue-100 px-3 py-1 rounded-full">
                                        Chiến dịch #
                                        {Number.isFinite(id) ? id : "-"}
                                    </span>
                                </div>
                                <h1 className="text-3xl font-bold text-slate-900">
                                    Chi tiết chiến dịch
                                </h1>
                            </div>
                        </div>
                    </div>
                </header>

                {/* Loading State - chỉ block khi on-chain data chưa sẵn */}
                {isLoading && (
                    <div className="space-y-6 animate-pulse">
                        <div className="rounded-2xl bg-white border border-slate-200 p-8 shadow-sm">
                            <div className="h-8 w-2/3 rounded bg-slate-200 mb-4" />
                            <div className="h-4 w-full rounded bg-slate-200 mb-2" />
                            <div className="h-4 w-5/6 rounded bg-slate-200" />
                        </div>
                    </div>
                )}

                {/* Error State */}
                {!isLoading && isError && (
                    <>
                        {typeof error === "string" &&
                            error
                                .toLowerCase()
                                .includes("does not exist on-chain") && (
                                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center">
                                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-amber-100 mb-4">
                                        <span className="text-2xl">⏳</span>
                                    </div>
                                    <p className="text-lg font-semibold text-amber-900 mb-2">
                                        Đang chờ cập nhật chiến dịch mới
                                    </p>
                                    <p className="text-sm text-amber-800 mb-4">
                                        Do on-chain vừa được tạo, hệ thống có
                                        thể cần vài giây để cập nhật đủ dữ liệu.
                                    </p>
                                    <button
                                        onClick={() => refetch()}
                                        className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-amber-600 text-white font-semibold hover:bg-amber-700 transition"
                                    >
                                        Thử lại ngay
                                    </button>
                                </div>
                            )}

                        {(!error ||
                            (typeof error === "string" &&
                                !error
                                    .toLowerCase()
                                    .includes("does not exist on-chain"))) && (
                            <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
                                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-100 mb-4">
                                    <span className="text-2xl">⚠️</span>
                                </div>
                                <p className="text-lg font-semibold text-red-900 mb-2">
                                    Không thể tải chiến dịch
                                </p>
                                <p className="text-sm text-red-700 mb-4">
                                    Đã xảy ra lỗi khi tải thông tin chiến dịch.
                                </p>
                                <button
                                    onClick={() => refetch()}
                                    className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 transition"
                                >
                                    Thử lại
                                </button>
                            </div>
                        )}
                    </>
                )}

                {/* Campaign Content - hiển thị khi on-chain data sẵn, backend data được merge khi tải xong */}
                {!isLoading && !isError && campaign && (
                    <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
                        {/* Left Column - Main Content */}
                        <div className="space-y-6">
                            {isStatusOutOfSync && (
                                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-6 py-4 text-amber-900">
                                    <p className="text-sm font-semibold">
                                        Trạng thái đang đồng bộ
                                    </p>
                                    <p className="text-xs text-amber-800">
                                        Trạng thái on-chain khác backend. Dữ
                                        liệu sẽ tự cập nhật sau khi đồng bộ.
                                    </p>
                                </div>
                            )}
                            <MilestonePreviewCard
                                campaignId={campaign.id}
                                campaignDeadline={campaign.deadline}
                                campaignCreatedAt={
                                    backendCampaign.data?.createdAt
                                }
                                progressPercent={progress}
                                goalWei={campaign.goal}
                                raisedWei={campaign.raised}
                                disbursedWei={campaign.totalDisbursed}
                                userDonatedWei={effectiveUserDonatedAmount}
                                milestoneCount={campaign.milestoneCount}
                                campaignStatusLabel={campaignStatusLabel}
                                currentMilestoneId={campaign.currentMilestoneId}
                            />

                            <CampaignInfoPanel
                                campaign={{
                                    ...campaign,
                                    statusLabel: campaignStatusLabel,
                                }}
                                userDonatedWei={effectiveUserDonatedAmount}
                                backendTitle={
                                    !isPlaceholderCampaignTitle(
                                        backendCampaign.data?.title,
                                        id,
                                    )
                                        ? backendCampaign.data?.title
                                        : cachedMetadata?.title
                                }
                                backendDescription={
                                    !isPlaceholderCampaignDescription(
                                        backendCampaign.data?.description,
                                    )
                                        ? backendCampaign.data?.description
                                        : cachedMetadata?.description
                                }
                                reviewerSafe={
                                    backendCampaign.data?.reviewerSafe
                                }
                                progress={progress}
                                thumbnailUrl={
                                    backendCampaign.data?.thumbnailUrl ?? null
                                }
                            />

                            {/* Donation History Card */}
                            <div className="rounded-2xl bg-white border border-slate-200 p-8 shadow-sm">
                                <div className="flex items-center justify-between mb-6">
                                    <h3 className="text-xl font-bold text-slate-900">
                                        Lịch sử quyên góp
                                    </h3>
                                    <div className="flex items-center gap-3">
                                        <span className="text-sm font-medium text-slate-600">
                                            {donations.length} lượt quyên góp
                                        </span>
                                        <button
                                            onClick={handleReloadDonations}
                                            type="button"
                                            className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                        >
                                            Tải lại lịch sử
                                        </button>
                                    </div>
                                </div>
                                {donationHistoryWarning && (
                                    <p className="mb-4 text-xs text-amber-700">
                                        {donationHistoryWarning}
                                    </p>
                                )}
                                {isDonationHistoryLoading && (
                                    <p className="mb-4 text-xs text-slate-500">
                                        Đang tải lịch sử quyên góp...
                                    </p>
                                )}

                                {donations.length === 0 ? (
                                    <div className="text-center py-12">
                                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 mb-4">
                                            <span className="text-3xl">💝</span>
                                        </div>
                                        <p className="text-slate-600 mb-2">
                                            Chưa có quyên góp
                                        </p>
                                        <p className="text-sm text-slate-500">
                                            Hãy là người đầu tiên ủng hộ!
                                        </p>
                                    </div>
                                ) : (
                                    <>
                                        <div className="space-y-3">
                                            {donations.map(
                                                (donation, index) => (
                                                    <div
                                                        key={`${donation.transactionHash}-${index}`}
                                                        className="rounded-xl bg-slate-50 border border-slate-200 p-4 hover:bg-slate-100 transition"
                                                    >
                                                        <div className="flex items-center justify-between mb-2">
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-8 h-8 rounded-full bg-linear-to-br from-green-400 to-green-600" />
                                                                <div>
                                                                    <code className="text-sm font-mono text-slate-900">
                                                                        {donation.donor.slice(
                                                                            0,
                                                                            6,
                                                                        )}
                                                                        ...
                                                                        {donation.donor.slice(
                                                                            -4,
                                                                        )}
                                                                    </code>
                                                                    <p className="text-xs text-slate-500">
                                                                        {new Date(
                                                                            donation.timestamp,
                                                                        ).toLocaleString()}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                            <p className="text-lg font-bold text-green-600">
                                                                +
                                                                {Number(
                                                                    formatEther(
                                                                        donation.amount,
                                                                    ),
                                                                ).toFixed(
                                                                    4,
                                                                )}{" "}
                                                                ETH
                                                            </p>
                                                        </div>
                                                        <a
                                                            href={`https://sepolia.etherscan.io/tx/${donation.transactionHash}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
                                                        >
                                                            Xem giao dịch →
                                                        </a>
                                                    </div>
                                                ),
                                            )}
                                        </div>
                                        {topDonors.length > 0 && (
                                            <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
                                                <div className="mb-3 flex items-center justify-between">
                                                    <p className="text-sm font-semibold text-slate-900">
                                                        Bảng xếp hạng nhà hảo
                                                        tâm
                                                    </p>
                                                    <p className="text-xs text-slate-500">
                                                        Top {topDonors.length}{" "}
                                                        theo tổng ETH đã quyên
                                                        góp
                                                    </p>
                                                </div>
                                                <div className="space-y-2">
                                                    {topDonors.map(
                                                        (item, index) => (
                                                            <div
                                                                key={item.donor}
                                                                className="flex items-center justify-between rounded-lg bg-white px-3 py-2"
                                                            >
                                                                <div className="flex items-center gap-3">
                                                                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-blue-700">
                                                                        {index +
                                                                            1}
                                                                    </span>
                                                                    <code className="text-xs font-mono text-slate-900">
                                                                        {item.donor.slice(
                                                                            0,
                                                                            6,
                                                                        )}
                                                                        ...
                                                                        {item.donor.slice(
                                                                            -4,
                                                                        )}
                                                                    </code>
                                                                </div>
                                                                <p className="text-sm font-semibold text-emerald-700">
                                                                    {Number(
                                                                        formatEther(
                                                                            item.totalAmount,
                                                                        ),
                                                                    ).toFixed(
                                                                        4,
                                                                    )}{" "}
                                                                    ETH
                                                                </p>
                                                            </div>
                                                        ),
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Right Column - Actions */}
                        <div className="lg:sticky lg:top-6 h-fit space-y-4">
                            {hasMounted && (
                                <>
                                    {shouldMarkAsFailed && (
                                        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
                                            <p className="text-sm font-semibold text-amber-900 mb-2">
                                                Campaign đã quá deadline nhưng
                                                chưa cập nhật thất bại
                                            </p>
                                            <p className="text-xs text-amber-800 mb-4">
                                                Bấm để ghi nhận trạng thái thất
                                                bại on-chain, sau đó donor có
                                                thể refund.
                                            </p>
                                            <button
                                                onClick={handleMarkAsFailed}
                                                disabled={
                                                    markAsFailedPending ||
                                                    markAsFailedConfirming
                                                }
                                                className="w-full rounded-lg bg-amber-600 px-4 py-3 text-sm font-semibold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
                                            >
                                                {markAsFailedPending
                                                    ? "⏳ Đợi xác nhận từ ví..."
                                                    : markAsFailedConfirming
                                                      ? "🔄 Đang xác nhận..."
                                                      : "Cập nhật trạng thái thất bại"}
                                            </button>
                                        </div>
                                    )}
                                    {shouldMarkMilestoneAsFailed && (
                                        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 shadow-sm">
                                            <div className="flex items-center gap-2 mb-2 text-red-900">
                                                <span className="text-xl">
                                                    ⚠️
                                                </span>
                                                <p className="text-sm font-bold">
                                                    Mốc hiện tại đã quá hạn nộp
                                                    minh chứng
                                                </p>
                                            </div>
                                            <p className="text-xs text-red-800 mb-4">
                                                Thời hạn của mốc này đã kết
                                                thúc. Bạn cần xác nhận thất bại
                                                trên Blockchain để hệ thống mở
                                                tính năng hoàn tiền cho mọi
                                                người.
                                            </p>
                                            <button
                                                onClick={
                                                    handleMarkMilestoneAsFailed
                                                }
                                                disabled={
                                                    milestoneFailedPending ||
                                                    milestoneFailedConfirming
                                                }
                                                className="w-full rounded-lg bg-red-600 px-4 py-3 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60 transition shadow-md hover:shadow-lg"
                                            >
                                                {milestoneFailedPending
                                                    ? "⏳ Đợi xác nhận từ ví..."
                                                    : milestoneFailedConfirming
                                                      ? "🔄 Đang đồng bộ Blockchain..."
                                                      : "Xác nhận thất bại On-chain"}
                                            </button>
                                        </div>
                                    )}
                                    <RefundAndMintPanel
                                        showRefund={Boolean(
                                            (isCampaignFailed ||
                                                isCampaignPartialFailed) &&
                                            userDonatedAmount > 0n,
                                        )}
                                        showMint={Boolean(
                                            canMintCertificate &&
                                            effectiveUserDonatedAmount > 0n &&
                                            !hasMintedCertificate,
                                        )}
                                        hasRefunded={
                                            refundStatus?.status ===
                                                "refunded" ||
                                            ((isCampaignFailed ||
                                                isCampaignPartialFailed) &&
                                                userDonatedAmount > 0n &&
                                                donatedAmountOnChain === 0n)
                                        }
                                        refundPending={
                                            isCampaignPartialFailed
                                                ? milestoneRefundPending
                                                : fundingRefundPending
                                        }
                                        refundConfirming={refundConfirming}
                                        refundConfirmed={refundConfirmed}
                                        refundHash={
                                            isCampaignPartialFailed
                                                ? milestoneRefundHash
                                                : fundingRefundHash
                                        }
                                        mintPending={mintPending}
                                        mintConfirming={mintConfirming}
                                        mintConfirmed={mintConfirmed}
                                        mintHash={mintHash}
                                        mintProfileSaving={mintProfileSaving}
                                        defaultDisplayName={
                                            user?.displayName || ""
                                        }
                                        onRefund={handleRefund}
                                        onMint={handleMintCertificate}
                                    />
                                    <DonatePanel
                                        amount={amount}
                                        canDonate={canDonate}
                                        isConnected={isConnected}
                                        isSepolia={isSepolia}
                                        campaignStatusLabel={
                                            campaignStatusLabel as
                                                | "pending_approval"
                                                | "active"
                                                | "in_progress"
                                                | "completed"
                                                | "partial_failed"
                                                | "failed"
                                                | "cancelled"
                                        }
                                        isPending={isPending}
                                        isConfirming={isConfirming}
                                        isConfirmed={isConfirmed}
                                        txHash={hash}
                                        donateError={getFriendlyError(
                                            donateError,
                                        )}
                                        onAmountChange={setAmount}
                                        onDonate={handleDonate}
                                    />

                                    {/* Network Info */}
                                    {/* Network Info */}
                                    <div className="rounded-xl bg-white border border-slate-200 p-4 text-center">
                                        <div className="flex items-center justify-center gap-2 mb-1">
                                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                            <p className="text-xs font-semibold text-slate-600">
                                                MẠNG THỬ NGHIỆM SEPOLIA
                                            </p>
                                        </div>
                                        <p className="text-xs text-slate-500">
                                            Mọi giao dịch diễn ra trên Ethereum
                                            Sepolia
                                        </p>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
