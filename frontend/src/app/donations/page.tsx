"use client";

import DonationHistoryList from "@/components/donations/DonationHistoryList";
import DonationSummaryCards from "@/components/donations/DonationSummaryCards";
import BackButton from "@/components/navigation/BackButton";
import TransactionHistoryModal from "@/components/transactions/TransactionHistoryModal";
import {
    contractConfig,
    getCampaignMetadataFromCache,
    isPlaceholderCampaignTitle,
    useBackendCampaigns,
    useBackendDonations,
    useBackendTransactions,
} from "@/lib";
import type { DonationRecord } from "@/lib/api/types";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { formatEther, parseAbiItem } from "viem";
import { useAccount, usePublicClient } from "wagmi";
import { showErrorToast } from "@/lib/ui/toast";

function MyDonationsContent() {
    const searchParams = useSearchParams();
    const { address, isConnected, chain } = useAccount();
    const publicClient = usePublicClient({ chainId: contractConfig.chainId });
    const [showTxModal, setShowTxModal] = useState(false);
    const [onChainDonations, setOnChainDonations] = useState<DonationRecord[]>(
        [],
    );
    const [allOnChainDonations, setAllOnChainDonations] = useState<
        DonationRecord[]
    >([]);
    const [isOnChainLoading, setIsOnChainLoading] = useState(false);
    const campaignIdFilter = useMemo(() => {
        const raw = searchParams.get("campaignId");
        if (!raw) return null;
        const parsed = Number(raw);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    }, [searchParams]);
    const donationQuery = useBackendDonations(
        address ?? null,
        campaignIdFilter,
    );
    const transactionQuery = useBackendTransactions(address ?? null);
    const campaignsQuery = useBackendCampaigns();

    useEffect(() => {
        const fetchOnChainDonations = async () => {
            if (!publicClient) return;

            try {
                setIsOnChainLoading(true);
                const latestBlock = await publicClient.getBlockNumber();
                const maxBlocksToScan = 500n;
                const chunkSize = 10n;
                const fromBlock =
                    latestBlock > maxBlocksToScan
                        ? latestBlock - maxBlocksToScan + 1n
                        : 0n;
                const logs: Awaited<ReturnType<typeof publicClient.getLogs>> =
                    [];

                for (
                    let chunkFrom = fromBlock;
                    chunkFrom <= latestBlock;
                    chunkFrom += chunkSize
                ) {
                    const chunkTo =
                        chunkFrom + chunkSize - 1n > latestBlock
                            ? latestBlock
                            : chunkFrom + chunkSize - 1n;
                    const chunkLogs = await publicClient.getLogs({
                        address: contractConfig.address,
                        event: parseAbiItem(
                            "event Donated(uint256 indexed campaignId, address indexed donor, uint256 amount)",
                        ),
                        fromBlock: chunkFrom,
                        toBlock: chunkTo,
                    });
                    logs.push(...chunkLogs);
                }

                const mapped = await Promise.all(
                    logs.map(async (log) => {
                        const args = (
                            log as {
                                args?: {
                                    campaignId?: bigint;
                                    amount?: bigint;
                                    donor?: string;
                                };
                                blockNumber?: bigint | null;
                            }
                        ).args;
                        const campaignOnChainId = Number(
                            args?.campaignId ?? 0n,
                        );
                        const amountWei = args?.amount ?? 0n;
                        const donorWallet = (args?.donor ?? "").toString();
                        const blockNumber = (
                            log as { blockNumber?: bigint | null }
                        ).blockNumber;
                        const block = blockNumber
                            ? await publicClient.getBlock({ blockNumber })
                            : null;
                        return {
                            txHash: log.transactionHash ?? "",
                            campaignOnChainId,
                            donorWallet,
                            amount: amountWei.toString(),
                            amountEth: Number(formatEther(amountWei)),
                            donatedAt: new Date(
                                block
                                    ? Number(block.timestamp) * 1000
                                    : Date.now(),
                            ).toISOString(),
                        } satisfies DonationRecord;
                    }),
                );

                const sorted = mapped
                    .filter((item) => item.txHash)
                    .sort(
                        (a, b) =>
                            new Date(b.donatedAt).getTime() -
                            new Date(a.donatedAt).getTime(),
                    );

                setAllOnChainDonations(sorted);
                if (address) {
                    const lowerAddress = address.toLowerCase();
                    setOnChainDonations(
                        sorted.filter(
                            (item) =>
                                item.donorWallet.toLowerCase() === lowerAddress,
                        ),
                    );
                } else {
                    setOnChainDonations([]);
                }
            } catch {
                setOnChainDonations([]);
                setAllOnChainDonations([]);
            } finally {
                setIsOnChainLoading(false);
            }
        };

        fetchOnChainDonations();
    }, [address, publicClient]);

    const campaignTitleById = useMemo(() => {
        const map = new Map<number, string>();
        campaignsQuery.data.forEach((campaign) => {
            const cached = getCampaignMetadataFromCache(campaign.onChainId);
            const effectiveTitle = !isPlaceholderCampaignTitle(
                campaign.title,
                campaign.onChainId,
            )
                ? campaign.title
                : cached?.title || `Chiến dịch #${campaign.onChainId}`;
            map.set(campaign.onChainId, effectiveTitle);
        });
        return map;
    }, [campaignsQuery.data]);

    const effectiveDonations = useMemo(() => {
        const byTxHash = new Map<string, DonationRecord>();

        [...donationQuery.data, ...onChainDonations].forEach((item) => {
            if (!item.txHash) return;
            byTxHash.set(item.txHash.toLowerCase(), item);
        });

        return Array.from(byTxHash.values()).sort(
            (a, b) =>
                new Date(b.donatedAt).getTime() -
                new Date(a.donatedAt).getTime(),
        );
    }, [donationQuery.data, onChainDonations]);

    const totalDonatedEth = useMemo(
        () =>
            effectiveDonations.reduce(
                (sum, donation) => sum + donation.amountEth,
                0,
            ),
        [effectiveDonations],
    );

    const txItems = useMemo(
        () =>
            transactionQuery.data.map((tx) => ({
                txHash: tx.txHash,
                campaignId: tx.campaignOnChainId ?? undefined,
                campaignName: tx.campaignOnChainId
                    ? `Chiến dịch #${tx.campaignOnChainId}`
                    : "Chiến dịch không xác định",
                status: tx.status,
                timestamp: new Date(tx.updatedAt || tx.createdAt).getTime(),
            })),
        [transactionQuery.data],
    );

    const donationItems = useMemo(() => {
        const txStatusByHash = new Map(
            transactionQuery.data.map(
                (tx) => [tx.txHash.toLowerCase(), tx.status] as const,
            ),
        );

        return effectiveDonations.map((donation) => ({
            ...donation,
            status:
                txStatusByHash.get(donation.txHash.toLowerCase()) ?? "success",
            campaignTitle: campaignTitleById.get(donation.campaignOnChainId),
        }));
    }, [campaignTitleById, effectiveDonations, transactionQuery.data]);

    const publicDonationItems = useMemo(
        () =>
            allOnChainDonations.map((donation) => ({
                ...donation,
                status: "success" as const,
                campaignTitle: campaignTitleById.get(
                    donation.campaignOnChainId,
                ),
            })),
        [allOnChainDonations, campaignTitleById],
    );

    useEffect(() => {
        if (!donationQuery.error) return;
        showErrorToast(donationQuery.error);
    }, [donationQuery.error]);

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-5xl mx-auto">
                <div className="mb-8">
                    <div className="flex items-center gap-3 mb-4">
                        <BackButton fallbackHref="/" />
                        <div>
                            <h1 className="text-3xl font-bold text-slate-900">
                                Lịch sử quyên góp
                            </h1>
                        </div>
                    </div>
                </div>

                {!isConnected && (
                    <div className="mb-6 rounded-2xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-900">
                        Bạn đang xem lịch sử quyên góp toàn hệ thống (on-chain).
                        Kết nối ví để xem thêm mục "Quyên góp của tôi".
                    </div>
                )}
                {isConnected && chain?.id !== 11155111 && (
                    <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
                        Bạn đang ở sai mạng. Một số dữ liệu cá nhân có thể không
                        đồng bộ đầy đủ. Vui lòng chuyển về Sepolia.
                    </div>
                )}

                {address && chain?.id === 11155111 && (
                    <DonationSummaryCards
                        wallet={address}
                        donationCount={effectiveDonations.length}
                        totalEth={totalDonatedEth.toFixed(4)}
                    />
                )}

                {address && chain?.id === 11155111 && (
                    <div className="mb-6 bg-white rounded-2xl border border-slate-200 shadow-lg p-8">
                        <div className="flex items-center justify-between gap-3 mb-6">
                            <h2 className="text-xl font-bold text-slate-900">
                                Quyên góp của tôi
                            </h2>
                            <button
                                onClick={() => setShowTxModal(true)}
                                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            >
                                Xem nhật ký giao dịch
                            </button>
                        </div>
                        {campaignIdFilter && (
                            <p className="mb-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
                                Đang lọc theo campaign #{campaignIdFilter}.
                            </p>
                        )}

                        {transactionQuery.error && (
                            <p className="mb-4 text-xs text-amber-700">
                                Không thể tải đầy đủ nhật ký giao dịch. Trạng
                                thái quyên góp hiển thị theo dữ liệu đã index.
                            </p>
                        )}
                        {effectiveDonations.length >
                            donationQuery.data.length &&
                            onChainDonations.length > 0 && (
                                <p className="mb-4 text-xs text-blue-700">
                                    Đang bổ sung quyên góp từ on-chain để bù
                                    phần backend index chưa đồng bộ kịp.
                                </p>
                            )}

                        {(donationQuery.isLoading || isOnChainLoading) && (
                            <p className="text-sm text-slate-600">
                                Đang tải dữ liệu...
                            </p>
                        )}
                        {!donationQuery.isLoading &&
                            !donationQuery.error &&
                            (donationItems.length > 0 ? (
                                <DonationHistoryList
                                    donations={donationItems}
                                />
                            ) : (
                                <div className="text-center py-12">
                                    <p className="text-slate-900 font-semibold mb-2">
                                        Chưa có quyên góp
                                    </p>
                                    <Link
                                        href="/campaigns"
                                        className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition"
                                    >
                                        Duyệt chiến dịch
                                    </Link>
                                </div>
                            ))}
                    </div>
                )}
            </div>

            <TransactionHistoryModal
                open={showTxModal}
                onClose={() => setShowTxModal(false)}
                title="Lịch sử giao dịch backend"
                transactions={txItems}
            />
        </div>
    );
}

export default function MyDonationsPage() {
    return (
        <Suspense
            fallback={
                <div className="min-h-screen flex items-center justify-center text-slate-500">
                    Đang tải...
                </div>
            }
        >
            <MyDonationsContent />
        </Suspense>
    );
}
