'use client';

import {
  contractConfig,
  createTransaction,
  getDonationsByCampaign,
  getCampaignMetadataFromCache,
  isPlaceholderCampaignDescription,
  isPlaceholderCampaignTitle,
  toAuthUserProfile,
  updateUserProfile,
  useAuth,
  useBackendCampaign,
  useDonateToCampaign,
  useMarkAsFailed,
  useMintCertificate,
  useReadCampaign,
  useRefundDonation,
  useWithdrawFunds,
} from "@/lib";
import { showErrorToast, showSuccessToast } from "@/lib/ui/toast";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { formatEther, parseAbiItem } from "viem";
import { useAccount, usePublicClient, useReadContract, useWaitForTransactionReceipt, useWatchContractEvent } from "wagmi";
import CampaignInfoPanel from "@/components/campaign-detail/CampaignInfoPanel";
import CreatorActionsPanel from "@/components/campaign-detail/CreatorActionsPanel";
import DonatePanel from "@/components/campaign-detail/DonatePanel";
import RefundAndMintPanel from "@/components/campaign-detail/RefundAndMintPanel";
import BackButton from "@/components/navigation/BackButton";

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
    const id = Number(params?.id);
    const { campaign, isLoading, isError, error, refetch } = useReadCampaign(
        Number.isFinite(id) ? id : null
    );
    const backendCampaign = useBackendCampaign(Number.isFinite(id) ? id : null);
    const { token, user, setAuth } = useAuth();
    const [amount, setAmount] = useState("0.01");
    const [donations, setDonations] = useState<DonationEvent[]>([]);
    const [donationReloadNonce, setDonationReloadNonce] = useState(0);
    const [mintProfileSaving, setMintProfileSaving] = useState(false);
    const [mintFlowError, setMintFlowError] = useState<string | null>(null);
    const publicClient = usePublicClient({ chainId: contractConfig.chainId });
    const [donationHistoryWarning, setDonationHistoryWarning] = useState<string | null>(null);
    const { donate, hash, isPending, error: donateError } = useDonateToCampaign();
    const { withdrawFunds, hash: withdrawHash, isPending: withdrawPending, error: withdrawError } = useWithdrawFunds();
    const { refund, hash: refundHash, isPending: refundPending, error: refundError } = useRefundDonation();
    const { markAsFailed, hash: markAsFailedHash, isPending: markAsFailedPending, error: markAsFailedError } = useMarkAsFailed();
    const { mintCertificate, hash: mintHash, isPending: mintPending, error: mintError } = useMintCertificate();

    const { isLoading: isConfirming, isSuccess: isConfirmed } =
        useWaitForTransactionReceipt({
            hash,
        });

    const { isLoading: withdrawConfirming, isSuccess: withdrawConfirmed } =
        useWaitForTransactionReceipt({
            hash: withdrawHash,
        });

    const { isLoading: refundConfirming, isSuccess: refundConfirmed } =
        useWaitForTransactionReceipt({
            hash: refundHash,
        });
    const { isLoading: mintConfirming, isSuccess: mintConfirmed } =
        useWaitForTransactionReceipt({
            hash: mintHash,
        });
    const { isLoading: markAsFailedConfirming, isSuccess: markAsFailedConfirmed } =
        useWaitForTransactionReceipt({
            hash: markAsFailedHash,
        });

    const { data: hasMintedCertificate } = useReadContract({
        ...contractConfig,
        functionName: 'hasMintedCertificate',
        args: Number.isFinite(id) && address ? [BigInt(id), address] : undefined,
        query: { enabled: Number.isFinite(id) && !!address },
    });
    const { data: donatedAmountOnChain } = useReadContract({
        ...contractConfig,
        functionName: 'getDonation',
        args: Number.isFinite(id) && address ? [BigInt(id), address] : undefined,
        query: { enabled: Number.isFinite(id) && !!address },
    });

    const mergeDonations = (current: DonationEvent[], incoming: DonationEvent[]) => {
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

        return Array.from(byTxHash.values()).sort((a, b) => b.timestamp - a.timestamp);
    };

    useEffect(() => {
        const loadInitialDonations = async () => {
            if (!Number.isFinite(id)) return;

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
                    }))
                );
                hasAtLeastOneSource = true;
            } catch {
                // Backend can lag behind indexer; keep loading from on-chain logs.
            }

            if (publicClient) {
                try {
                    const logs = await publicClient.getLogs({
                        address: contractConfig.address,
                        event: parseAbiItem('event Donated(uint256 indexed campaignId, address indexed donor, uint256 amount)'),
                        args: { campaignId: BigInt(id) },
                        fromBlock: 'earliest',
                        toBlock: 'latest',
                    });

                    const onChainDonations = await Promise.all(
                        logs.map(async (log) => {
                            const args = (log as { args?: { campaignId?: bigint; donor?: string; amount?: bigint } }).args;
                            return {
                                campaignId: Number(args?.campaignId ?? BigInt(id)),
                                donor: args?.donor ?? '',
                                amount: args?.amount ?? BigInt(0),
                                transactionHash: log.transactionHash ?? '',
                                // Avoid extra per-log RPC calls (getBlock) to prevent list being empty on flaky RPC.
                                timestamp: Date.now(),
                            } satisfies DonationEvent;
                        })
                    );

                    merged.push(...onChainDonations);
                    hasAtLeastOneSource = true;
                } catch {
                    // Keep backend snapshot if on-chain lookup fails.
                }
            }

            setDonations((prev) => mergeDonations(prev, merged));
            setDonationHistoryWarning(
                hasAtLeastOneSource ? null : "Không thể tải lịch sử quyên góp từ backend/on-chain. Vui lòng thử lại sau."
            );
        };

        loadInitialDonations();
    }, [donationReloadNonce, id, publicClient]);

    // Check if user is creator
    const isCreator = address && campaign && address.toLowerCase() === campaign.creator.toLowerCase();

    // Campaign outcome inferred from on-chain goal vs raised.
    const isSucceededCampaign = Boolean(campaign && campaign.completed && campaign.raised >= campaign.goal);
    const isFailedCampaign = Boolean(campaign && campaign.completed && campaign.raised < campaign.goal);
    const shouldMarkAsFailed = Boolean(
        campaign &&
        !campaign.completed &&
        campaign.raised < campaign.goal &&
        campaign.deadline > 0 &&
        Math.floor(Date.now() / 1000) >= campaign.deadline
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
        return onChain > userDonatedAmount ? onChain : userDonatedAmount;
    }, [donatedAmountOnChain, userDonatedAmount]);

    // Watch for donation events
    useWatchContractEvent({
        ...contractConfig,
        eventName: "Donated",
        onLogs: (logs) => {
            const newDonations = logs
                .map((log) => {
                const args = (log as { args?: { campaignId?: bigint; donor?: string; amount?: bigint } }).args;
                return {
                    campaignId: Number(args?.campaignId || 0),
                    donor: args?.donor || '',
                    amount: args?.amount || BigInt(0),
                    transactionHash: log.transactionHash || '',
                    timestamp: Date.now(),
                };
                })
                .filter((item) => item.campaignId === id);

            setDonations((prev) => mergeDonations(prev, newDonations));
            refetch();
        },
    });

    const getFriendlyError = (err?: { message?: string } | null) => {
        if (!err?.message) return null;
        const msg = err.message.toLowerCase();
        if (msg.includes("user rejected") || msg.includes("user denied")) {
            return "Bạn đã từ chối giao dịch.";
        }
        if (msg.includes("insufficient funds")) {
            return "Không đủ ETH để trả phí gas. Vui lòng nạp thêm ETH testnet.";
        }
        if (msg.includes("network") || msg.includes("rpc")) {
            return "Lỗi mạng/RPC. Vui lòng thử lại hoặc đổi RPC.";
        }
        if (msg.includes("wrong network") || msg.includes("chain")) {
            return "Sai mạng. Vui lòng chuyển sang Sepolia.";
        }
        if (msg.includes("deadline not reached")) {
            return "Campaign chưa tới deadline nên chưa thể đánh dấu Failed.";
        }
        if (msg.includes("has reached its goal")) {
            return "Campaign đã đạt mục tiêu nên không thể đánh dấu Failed.";
        }
        if (msg.includes("not active")) {
            return "Campaign không còn ở trạng thái Active.";
        }
        return err.message;
    };

    useEffect(() => {
        if (isConfirmed) {
            refetch();
            setAmount("0.01");
            showSuccessToast("Quyên góp thành công! Giao dịch đang được xác nhận.");
        }
    }, [isConfirmed, refetch]);

    const handleDonate = () => {
        if (!Number.isFinite(id)) return;
        if (parseFloat(amount) <= 0) return;
        donate(id, amount).catch((err) => {
            const friendly = getFriendlyError(err);
            showErrorToast(friendly || "Không thể thực hiện quyên góp. Vui lòng thử lại.");
        });
    };

    const handleWithdraw = () => {
        if (!Number.isFinite(id)) return;
        try {
            withdrawFunds(id);
        } catch (err) {
            const friendly = getFriendlyError(err as { message?: string });
            showErrorToast(friendly || "Không thể rút tiền từ chiến dịch. Vui lòng thử lại.");
        }
    };

    const handleRefund = () => {
        if (!Number.isFinite(id)) return;
        try {
            refund(id);
        } catch (err) {
            const friendly = getFriendlyError(err as { message?: string });
            showErrorToast(friendly || "Không thể hoàn tiền. Vui lòng thử lại.");
        }
    };

    const handleMintCertificate = async (displayName: string) => {
        if (!Number.isFinite(id)) return;
        if (!address) {
            setMintFlowError("Vui lòng kết nối ví trước khi mint certificate.");
            return;
        }
        if (!token) {
            setMintFlowError("Bạn cần đăng nhập lại để cập nhật tên hiển thị trước khi mint.");
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
            const message = err instanceof Error ? err.message : "Không thể cập nhật tên hiển thị trước khi mint.";
            setMintFlowError(message);
            const friendly = getFriendlyError({ message } as { message: string });
            showErrorToast(friendly || message);
        } finally {
            setMintProfileSaving(false);
        }
    };
    const handleReloadDonations = () => {
        setDonationReloadNonce((prev) => prev + 1);
    };
    const handleMarkAsFailed = () => {
        if (!Number.isFinite(id)) return;
        try {
            markAsFailed(id);
        } catch (err) {
            const friendly = getFriendlyError(err as { message?: string });
            showErrorToast(friendly || "Không thể cập nhật trạng thái Failed. Vui lòng thử lại.");
        }
    };

    useEffect(() => {
        if (markAsFailedConfirmed) {
            refetch();
            showSuccessToast("Đã cập nhật campaign sang trạng thái Failed.");
        }
    }, [markAsFailedConfirmed, refetch]);

    useEffect(() => {
        const txHash = mintHash || hash;
        if (!txHash || !address) return;

        const action = mintHash ? 'mintNFT' : 'donate';

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
    const canDonate = Boolean(isConnected && isSepolia && campaign && !campaign.completed);

    const isBackendInitializing =
        backendCampaign.isLoading ||
        isPlaceholderCampaignTitle(backendCampaign.data?.title, id) ||
        isPlaceholderCampaignDescription(backendCampaign.data?.description);

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white text-slate-900">
            <main className="mx-auto w-full max-w-6xl px-6 py-12 md:px-10">
                {/* Page Header */}
                <header className="flex flex-col gap-4 mb-8">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <BackButton fallbackHref="/campaigns" preferFallback />
                            <div>
                                <div className="inline-flex items-center gap-2 mb-1">
                                    <span className="text-xs font-semibold text-blue-600 bg-blue-100 px-3 py-1 rounded-full">
                                        {isLoading || isBackendInitializing
                                            ? "Đang khởi tạo chiến dịch..."
                                            : `Campaign #${Number.isFinite(id) ? id : "-"}`}
                                    </span>
                                </div>
                                <h1 className="text-3xl font-bold text-slate-900">Chi tiết chiến dịch</h1>
                            </div>
                        </div>
                    </div>
                </header>

                {/* Loading State */}
                {(isLoading || isBackendInitializing) && (
                    <div className="space-y-6">
                        <div className="rounded-2xl bg-white border border-slate-200 p-8 shadow-sm animate-pulse">
                            <p className="mb-4 text-sm font-medium text-slate-600">
                                Chiến dịch đang trong quá trình khởi tạo, dữ liệu sẽ xuất hiện sau khi được đồng bộ.
                            </p>
                            <div className="h-8 w-2/3 rounded bg-slate-200 mb-4" />
                            <div className="h-4 w-full rounded bg-slate-200 mb-2" />
                            <div className="h-4 w-5/6 rounded bg-slate-200" />
                        </div>
                    </div>
                )}

                {/* Error State */}
                {!isLoading && isError && (
                    <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
                        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-100 mb-4">
                            <span className="text-2xl">⚠️</span>
                        </div>
                        <p className="text-lg font-semibold text-red-900 mb-2">Không thể tải chiến dịch</p>
                        <p className="text-sm text-red-700 mb-4">{error || "Có lỗi xảy ra."}</p>
                        <button
                            onClick={() => refetch()}
                            className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 transition"
                        >
                            Try Again
                        </button>
                    </div>
                )}

                {/* Campaign Content */}
                {!isLoading && !isBackendInitializing && !isError && campaign && (
                    <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
                        {/* Left Column - Main Content */}
                        <div className="space-y-6">
                            <CampaignInfoPanel
                                campaign={campaign}
                                backendTitle={
                                    !isPlaceholderCampaignTitle(backendCampaign.data?.title, id)
                                        ? backendCampaign.data?.title
                                        : undefined
                                }
                                backendDescription={
                                    !isPlaceholderCampaignDescription(backendCampaign.data?.description)
                                        ? backendCampaign.data?.description
                                        : undefined
                                }
                                progress={progress}
                            />

                            {/* Donation History Card */}
                            <div className="rounded-2xl bg-white border border-slate-200 p-8 shadow-sm">
                                <div className="flex items-center justify-between mb-6">
                                    <h3 className="text-xl font-bold text-slate-900">Lịch sử quyên góp</h3>
                                    <div className="flex items-center gap-3">
                                        <span className="text-sm font-medium text-slate-600">
                                            {donations.length} recent donation{donations.length !== 1 ? 's' : ''}
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
                                    <p className="mb-4 text-xs text-amber-700">{donationHistoryWarning}</p>
                                )}

                                {donations.length === 0 ? (
                                    <div className="text-center py-12">
                                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 mb-4">
                                            <span className="text-3xl">💝</span>
                                        </div>
                                        <p className="text-slate-600 mb-2">Chưa có quyên góp</p>
                                        <p className="text-sm text-slate-500">Hãy là người đầu tiên ủng hộ!</p>
                                    </div>
                                ) : (
                                    <>
                                        <div className="space-y-3">
                                            {donations.map((donation, index) => (
                                                <div
                                                    key={`${donation.transactionHash}-${index}`}
                                                    className="rounded-xl bg-slate-50 border border-slate-200 p-4 hover:bg-slate-100 transition"
                                                >
                                                    <div className="flex items-center justify-between mb-2">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-400 to-green-600" />
                                                            <div>
                                                                <code className="text-sm font-mono text-slate-900">
                                                                    {donation.donor.slice(0, 6)}...{donation.donor.slice(-4)}
                                                                </code>
                                                                <p className="text-xs text-slate-500">
                                                                    {new Date(donation.timestamp).toLocaleString()}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <p className="text-lg font-bold text-green-600">
                                                            +{Number(formatEther(donation.amount)).toFixed(4)} ETH
                                                        </p>
                                                    </div>
                                                    <a
                                                        href={`https://sepolia.etherscan.io/tx/${donation.transactionHash}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
                                                    >
                                                        View Transaction →
                                                    </a>
                                                </div>
                                            ))}
                                        </div>
                                        {topDonors.length > 0 && (
                                            <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
                                                <div className="mb-3 flex items-center justify-between">
                                                    <p className="text-sm font-semibold text-slate-900">
                                                        Bảng xếp hạng nhà hảo tâm
                                                    </p>
                                                    <p className="text-xs text-slate-500">
                                                        Top {topDonors.length} theo tổng ETH đã quyên góp
                                                    </p>
                                                </div>
                                                <div className="space-y-2">
                                                    {topDonors.map((item, index) => (
                                                        <div
                                                            key={item.donor}
                                                            className="flex items-center justify-between rounded-lg bg-white px-3 py-2"
                                                        >
                                                            <div className="flex items-center gap-3">
                                                                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-blue-700">
                                                                    {index + 1}
                                                                </span>
                                                                <code className="text-xs font-mono text-slate-900">
                                                                    {item.donor.slice(0, 6)}...{item.donor.slice(-4)}
                                                                </code>
                                                            </div>
                                                            <p className="text-sm font-semibold text-emerald-700">
                                                                {Number(formatEther(item.totalAmount)).toFixed(4)} ETH
                                                            </p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Right Column - Actions */}
                        <div className="lg:sticky lg:top-6 h-fit space-y-4">
                            {shouldMarkAsFailed && (
                                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
                                    <p className="text-sm font-semibold text-amber-900 mb-2">Campaign đã quá deadline nhưng chưa cập nhật Failed</p>
                                    <p className="text-xs text-amber-800 mb-4">
                                        Bấm để ghi nhận trạng thái Failed on-chain, sau đó donor có thể refund.
                                    </p>
                                    <button
                                        onClick={handleMarkAsFailed}
                                        disabled={markAsFailedPending || markAsFailedConfirming}
                                        className="w-full rounded-lg bg-amber-600 px-4 py-3 text-sm font-semibold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        {markAsFailedPending
                                            ? '⏳ Đợi xác nhận từ ví...'
                                            : markAsFailedConfirming
                                                ? '🔄 Đang xác nhận...'
                                                : 'Cập nhật trạng thái Failed'}
                                    </button>
                                    {markAsFailedError && (
                                        <p className="mt-3 text-xs text-red-700">{getFriendlyError(markAsFailedError)}</p>
                                    )}
                                </div>
                            )}
                            <CreatorActionsPanel
                                visible={Boolean(isCreator && isSucceededCampaign)}
                                isPending={withdrawPending}
                                isConfirming={withdrawConfirming}
                                isWithdrawn={campaign.withdrawn}
                                isConfirmed={withdrawConfirmed}
                                txHash={withdrawHash}
                                errorMessage={getFriendlyError(withdrawError)}
                                onWithdraw={handleWithdraw}
                            />
                            <RefundAndMintPanel
                                showRefund={Boolean(isFailedCampaign && effectiveUserDonatedAmount > 0n)}
                                showMint={Boolean(effectiveUserDonatedAmount > 0n && !hasMintedCertificate)}
                                refundPending={refundPending}
                                refundConfirming={refundConfirming}
                                refundConfirmed={refundConfirmed}
                                refundHash={refundHash}
                                refundError={getFriendlyError(refundError)}
                                mintPending={mintPending}
                                mintConfirming={mintConfirming}
                                mintConfirmed={mintConfirmed}
                                mintHash={mintHash}
                                mintError={mintFlowError || getFriendlyError(mintError)}
                                mintProfileSaving={mintProfileSaving}
                                defaultDisplayName={user?.displayName || ''}
                                onRefund={handleRefund}
                                onMint={handleMintCertificate}
                            />
                            <DonatePanel
                                amount={amount}
                                canDonate={canDonate}
                                isConnected={isConnected}
                                isSepolia={isSepolia}
                                campaignCompleted={campaign.completed}
                                isPending={isPending}
                                isConfirming={isConfirming}
                                isConfirmed={isConfirmed}
                                txHash={hash}
                                donateError={getFriendlyError(donateError)}
                                onAmountChange={setAmount}
                                onDonate={handleDonate}
                            />

                            {/* Network Info */}
                            <div className="rounded-xl bg-white border border-slate-200 p-4 text-center">
                                <div className="flex items-center justify-center gap-2 mb-1">
                                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                    <p className="text-xs font-semibold text-slate-600">SEPOLIA TESTNET</p>
                                </div>
                                <p className="text-xs text-slate-500">All transactions are on Ethereum Sepolia</p>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
