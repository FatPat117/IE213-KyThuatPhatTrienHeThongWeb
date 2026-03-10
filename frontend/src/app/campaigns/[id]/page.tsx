'use client';

import {
  contractConfig,
  createTransaction,
  useAuth,
  useBackendCampaign,
  useDonateToCampaign,
  useMintCertificate,
  useReadCampaign,
  useRefundDonation,
  useWithdrawFunds,
} from "@/lib";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { formatEther } from "viem";
import { useAccount, useReadContract, useWaitForTransactionReceipt, useWatchContractEvent } from "wagmi";
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
    const { token } = useAuth();
    const [amount, setAmount] = useState("0.01");
    const [donations, setDonations] = useState<DonationEvent[]>([]);
    const { donate, hash, isPending, error: donateError } = useDonateToCampaign();
    const { withdrawFunds, hash: withdrawHash, isPending: withdrawPending, error: withdrawError } = useWithdrawFunds();
    const { refund, hash: refundHash, isPending: refundPending, error: refundError } = useRefundDonation();
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

    const { data: hasMintedCertificate } = useReadContract({
        ...contractConfig,
        functionName: 'hasMintedCertificate',
        args: Number.isFinite(id) && address ? [BigInt(id), address] : undefined,
        query: { enabled: Number.isFinite(id) && !!address },
    });

    // Check if user is creator
    const isCreator = address && campaign && address.toLowerCase() === campaign.creator.toLowerCase();

    // Check if user has donated
    const userDonation = donations.find(d => d.donor.toLowerCase() === address?.toLowerCase());

    // Watch for donation events
    useWatchContractEvent({
        ...contractConfig,
        eventName: "Donated",
        onLogs: (logs) => {
            // Add new donations to the list
            const newDonations = logs.map((log) => {
                const args = (log as { args?: { campaignId?: bigint; donor?: string; amount?: bigint } }).args;
                return {
                    campaignId: Number(args?.campaignId || 0),
                    donor: args?.donor || '',
                    amount: args?.amount || BigInt(0),
                    transactionHash: log.transactionHash || '',
                    timestamp: Date.now(),
                };
            });
            setDonations((prev) => [...newDonations, ...prev]);
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
        return err.message;
    };

    useEffect(() => {
        if (isConfirmed) {
            refetch();
            setAmount("0.01"); // Reset amount after successful donation
        }
    }, [isConfirmed, refetch]);

    const handleDonate = () => {
        if (!Number.isFinite(id)) return;
        if (parseFloat(amount) <= 0) return;
        donate(id, amount);
    };

    const handleWithdraw = () => {
        if (!Number.isFinite(id)) return;
        withdrawFunds(id);
    };

    const handleRefund = () => {
        if (!Number.isFinite(id)) return;
        refund(id);
    };

    const handleMintCertificate = () => {
        if (!Number.isFinite(id)) return;
        mintCertificate(id);
    };

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

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white text-slate-900">
            <main className="mx-auto w-full max-w-6xl px-6 py-12 md:px-10">
                {/* Page Header */}
                <header className="flex flex-col gap-4 mb-8">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <BackButton fallbackHref="/campaigns" />
                            <div>
                                <div className="inline-flex items-center gap-2 mb-1">
                                    <span className="text-xs font-semibold text-blue-600 bg-blue-100 px-3 py-1 rounded-full">
                                        Campaign #{Number.isFinite(id) ? id : "-"}
                                    </span>
                                </div>
                                <h1 className="text-3xl font-bold text-slate-900">Chi tiết chiến dịch</h1>
                            </div>
                        </div>
                    </div>
                </header>

                {/* Loading State */}
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
                {!isLoading && !isError && campaign && (
                    <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
                        {/* Left Column - Main Content */}
                        <div className="space-y-6">
                            <CampaignInfoPanel
                                campaign={campaign}
                                backendTitle={backendCampaign.data?.title}
                                backendDescription={backendCampaign.data?.description}
                                progress={progress}
                            />

                            {/* Donation History Card */}
                            <div className="rounded-2xl bg-white border border-slate-200 p-8 shadow-sm">
                                <div className="flex items-center justify-between mb-6">
                                    <h3 className="text-xl font-bold text-slate-900">Lịch sử quyên góp</h3>
                                    <span className="text-sm font-medium text-slate-600">
                                        {donations.length} recent donation{donations.length !== 1 ? 's' : ''}
                                    </span>
                                </div>

                                {donations.length === 0 ? (
                                    <div className="text-center py-12">
                                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 mb-4">
                                            <span className="text-3xl">💝</span>
                                        </div>
                                        <p className="text-slate-600 mb-2">Chưa có quyên góp</p>
                                        <p className="text-sm text-slate-500">Hãy là người đầu tiên ủng hộ!</p>
                                    </div>
                                ) : (
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
                                )}
                            </div>
                        </div>

                        {/* Right Column - Actions */}
                        <div className="lg:sticky lg:top-6 h-fit space-y-4">
                            <CreatorActionsPanel
                                visible={Boolean(isCreator && campaign.completed)}
                                isPending={withdrawPending}
                                isConfirming={withdrawConfirming}
                                isWithdrawn={campaign.withdrawn}
                                isConfirmed={withdrawConfirmed}
                                txHash={withdrawHash}
                                errorMessage={getFriendlyError(withdrawError)}
                                onWithdraw={handleWithdraw}
                            />
                            <RefundAndMintPanel
                                showRefund={Boolean(!isCreator && campaign.completed && campaign.raised === 0n && userDonation)}
                                showMint={Boolean(!isCreator && userDonation && !hasMintedCertificate)}
                                refundPending={refundPending}
                                refundConfirming={refundConfirming}
                                refundConfirmed={refundConfirmed}
                                refundHash={refundHash}
                                refundError={getFriendlyError(refundError)}
                                mintPending={mintPending}
                                mintConfirming={mintConfirming}
                                mintConfirmed={mintConfirmed}
                                mintHash={mintHash}
                                mintError={getFriendlyError(mintError)}
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
