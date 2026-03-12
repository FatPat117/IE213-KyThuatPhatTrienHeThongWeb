'use client';

import BackButton from "@/components/navigation/BackButton";
import {
    getCampaignMetadataFromCache,
    isPlaceholderCampaignDescription,
    isPlaceholderCampaignTitle,
    useBackendCampaigns,
    useReadAllCampaigns
} from "@/lib";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState } from "react";
import { formatEther } from "viem";
import { useAccount, useChainId } from "wagmi";

const SEPOLIA_CHAIN_ID = 11155111;
function formatEthAmount(value: number) {
    if (!Number.isFinite(value) || value <= 0) return '0';
    if (value < 0.01) return value.toFixed(4).replace(/\.?0+$/, '');
    return value.toFixed(2);
}

function CampaignCardSkeleton() {
    return (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm animate-pulse">
            <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-slate-200" />
                <div className="flex-1 space-y-2">
                    <div className="h-5 w-2/3 rounded bg-slate-200" />
                    <div className="h-3 w-1/2 rounded bg-slate-200" />
                </div>
            </div>
            <div className="mt-5 space-y-3">
                <div className="h-3 w-2/5 rounded bg-slate-200" />
                <div className="h-3 w-3/5 rounded bg-slate-200" />
            </div>
            <div className="mt-5 h-2 w-full rounded-full bg-slate-200" />
            <div className="mt-4 h-10 w-32 rounded-lg bg-slate-200" />
        </div>
    );
}

function CampaignsPageContent() {
    const { data: campaigns, isLoading, error, refetch } = useBackendCampaigns();
    const {
        campaigns: onChainCampaigns,
        isLoading: isOnChainLoading,
        error: onChainError,
        refetch: refetchOnChain,
    } = useReadAllCampaigns();
    const { isConnected } = useAccount();
    const chainId = useChainId();
    const [searchQuery, setSearchQuery] = useState("");
    const [filterStatus, setFilterStatus] = useState<"all" | "active" | "ended">("all");
    const [sortBy, setSortBy] = useState<"newest" | "mostfunded" | "trending">("newest");
    const isSepoliaNetwork = chainId === SEPOLIA_CHAIN_ID;
    const canCreateCampaign = isConnected && isSepoliaNetwork;

    const backendCampaigns = useMemo(
        () =>
            campaigns.map((campaign) => {
                const cached = getCampaignMetadataFromCache(campaign.onChainId);
                return {
                    id: campaign.onChainId,
                    title: !isPlaceholderCampaignTitle(campaign.title, campaign.onChainId)
                        ? campaign.title
                        : (cached?.title || `Campaign #${campaign.onChainId}`),
                    description: !isPlaceholderCampaignDescription(campaign.description)
                        ? campaign.description
                        : (cached?.description || ""),
                    creator: campaign.creator,
                    goal: BigInt(campaign.goal || "0"),
                    raised: BigInt(campaign.raised || "0"),
                    completed: campaign.status !== "active",
                };
            }),
        [campaigns]
    );

    const normalizedCampaigns = useMemo(() => {
        const campaignMap = new Map<
            number,
            {
                id: number;
                title: string;
                description: string;
                creator: string;
                goal: bigint;
                raised: bigint;
                completed: boolean;
            }
        >();

        // Backend-first for metadata (title/description), then on-chain overrides numeric fields for freshness.
        backendCampaigns.forEach((campaign) => {
            campaignMap.set(campaign.id, campaign);
        });

        onChainCampaigns.forEach((campaign) => {
            const existing = campaignMap.get(campaign.id);
            if (existing) {
                campaignMap.set(campaign.id, {
                    ...existing,
                    creator: campaign.creator || existing.creator,
                    goal: campaign.goal,
                    raised: campaign.raised,
                    completed: campaign.completed,
                });
            } else {
                const cached = getCampaignMetadataFromCache(campaign.id);
                campaignMap.set(campaign.id, {
                    id: campaign.id,
                    title: cached?.title || `Campaign #${campaign.id}`,
                    description: cached?.description || "Campaign data is stored on-chain without off-chain metadata.",
                    creator: campaign.creator,
                    goal: campaign.goal,
                    raised: campaign.raised,
                    completed: campaign.completed,
                });
            }
        });

        return Array.from(campaignMap.values());
    }, [backendCampaigns, onChainCampaigns]);

    // Filter and search campaigns
    const filteredCampaigns = useMemo(() => {
        let result = [...normalizedCampaigns];

        // Apply status filter
        if (filterStatus === "active") {
            result = result.filter(c => !c.completed);
        } else if (filterStatus === "ended") {
            result = result.filter(c => c.completed);
        }

        // Apply search
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            result = result.filter(c =>
                c.title.toLowerCase().includes(query) ||
                c.description.toLowerCase().includes(query)
            );
        }

        // Apply sorting
        if (sortBy === "mostfunded") {
            result.sort((a, b) => Number(b.raised) - Number(a.raised));
        } else if (sortBy === "trending") {
            // Sort by percentage funded
            result.sort((a, b) => {
                const aPercent = Number(a.goal) > 0 ? Number(a.raised) / Number(a.goal) : 0;
                const bPercent = Number(b.goal) > 0 ? Number(b.raised) / Number(b.goal) : 0;
                return bPercent - aPercent;
            });
        } else {
            // newest - sort by ID descending
            result.sort((a, b) => b.id - a.id);
        }

        return result;
    }, [normalizedCampaigns, searchQuery, filterStatus, sortBy]);

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white text-slate-900">
            <main className="mx-auto w-full max-w-7xl px-6 py-12 md:px-10">
                {/* Back Button */}
                <div className="mb-6">
                    <BackButton fallbackHref="/" />
                </div>

                {/* Status Bar */}
                {!isConnected && (
                    <div className="mb-6 rounded-lg border border-blue-300 bg-blue-50 p-4">
                        <p className="text-sm font-semibold text-blue-900">👁️ Chế độ xem (read-only)</p>
                        <p className="text-xs text-blue-800 mt-1">
                            Bạn đang xem dữ liệu ở chế độ read-only. Kết nối ví để tạo chiến dịch và quyên góp.
                        </p>
                    </div>
                )}

                {isConnected && !isSepoliaNetwork && (
                    <div className="mb-6 rounded-lg border border-red-300 bg-red-50 p-4">
                        <p className="text-sm font-semibold text-red-900">⚠️ Mạng lưới sai</p>
                        <p className="text-xs text-red-800 mt-1">
                            Vui lòng chuyển sang mạng Sepolia để tạo chiến dịch hoặc quyên góp.
                        </p>
                    </div>
                )}

                {/* Page Header */}
                <header className="flex flex-col gap-6 mb-10">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                            <div className="inline-flex items-center gap-2 mb-3">
                                <span className="text-xs font-semibold text-blue-600 bg-blue-100 px-3 py-1 rounded-full">
                                    🔗 Dữ liệu On-Chain
                                </span>
                            </div>
                            <h1 className="text-4xl font-bold text-slate-900 mb-3">Tất cả chiến dịch</h1>
                            <p className="text-lg text-slate-600">
                                Khám phá các chiến dịch gây quỹ được ghi nhận trên Ethereum Sepolia
                            </p>
                        </div>
                        <div className="flex items-center gap-3 flex-wrap">
                            <button
                                onClick={() => {
                                    refetch();
                                    refetchOnChain();
                                }}
                                className="inline-flex items-center justify-center px-5 py-3 rounded-lg border-2 border-slate-200 text-slate-900 font-semibold hover:border-blue-600 hover:text-blue-600 transition duration-200"
                            >
                                🔄 Tải lại
                            </button>
                            {canCreateCampaign ? (
                                <Link
                                    href="/campaigns/create"
                                    className="inline-flex items-center justify-center px-5 py-3 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition duration-200 shadow-lg hover:shadow-xl"
                                >
                                    + Tạo chiến dịch
                                </Link>
                            ) : (
                                <button
                                    disabled
                                    title={!isConnected ? "Kết nối ví để tạo chiến dịch" : "Chuyển sang mạng Sepolia để tạo chiến dịch"}
                                    className="inline-flex items-center justify-center px-5 py-3 rounded-lg bg-slate-300 text-slate-600 font-semibold cursor-not-allowed"
                                >
                                    + Tạo chiến dịch
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Stats Summary */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="rounded-xl bg-white border border-slate-200 p-4 shadow-sm">
                            <p className="text-sm font-medium text-slate-600">Tổng chiến dịch</p>
                            <p className="text-2xl font-bold text-slate-900 mt-1">

                                {isLoading && isOnChainLoading ? "..." : normalizedCampaigns.length}
                            </p>
                        </div>
                        <div className="rounded-xl bg-white border border-slate-200 p-4 shadow-sm">
                            <p className="text-sm font-medium text-slate-600">Đang hoạt động</p>
                            <p className="text-2xl font-bold text-green-600 mt-1">
                                {isLoading && isOnChainLoading ? "..." : normalizedCampaigns.filter((c) => !c.completed).length}
                            </p>
                        </div>
                        <div className="rounded-xl bg-white border border-slate-200 p-4 shadow-sm">
                            <p className="text-sm font-medium text-slate-600">Đã kết thúc</p>
                            <p className="text-2xl font-bold text-slate-600 mt-1">
                                {isLoading && isOnChainLoading ? "..." : normalizedCampaigns.filter((c) => c.completed).length}
                            </p>
                        </div>
                        <div className="rounded-xl bg-white border border-slate-200 p-4 shadow-sm">
                            <p className="text-sm font-medium text-slate-600">Mạng</p>
                            <div className="flex items-center gap-2 mt-1">
                                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                <p className="text-sm font-bold text-slate-900">Sepolia</p>
                            </div>
                        </div>
                    </div>
                </header>

                {/* Search and Filter Bar */}
                <div className="mb-8 space-y-4">
                    {/* Search Input */}
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="🔍 Tìm theo tiêu đề hoặc mô tả..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full rounded-lg border-2 border-slate-200 bg-white px-4 py-3 text-slate-900 placeholder-slate-400 focus:border-blue-600 focus:outline-none transition"
                        />
                    </div>

                    {/* Filter and Sort Controls */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Status Filter */}
                        <div>
                            <label className="text-xs font-semibold text-slate-600 mb-2 block">Trạng thái</label>
                            <select
                                value={filterStatus}
                                onChange={(e) => setFilterStatus(e.target.value as "all" | "active" | "ended")}
                                className="w-full rounded-lg border-2 border-slate-200 bg-white px-3 py-2 text-slate-900 focus:border-blue-600 focus:outline-none transition"
                            >
                                <option value="all">Tất cả</option>
                                <option value="active">🔴 Đang hoạt động</option>
                                <option value="ended">Đã kết thúc</option>
                            </select>
                        </div>

                        {/* Sort By */}
                        <div>
                            <label className="text-xs font-semibold text-slate-600 mb-2 block">Sắp xếp</label>
                            <select
                                value={sortBy}
                                onChange={(e) =>
                                    setSortBy(e.target.value as "newest" | "mostfunded" | "trending")
                                }
                                className="w-full rounded-lg border-2 border-slate-200 bg-white px-3 py-2 text-slate-900 focus:border-blue-600 focus:outline-none transition"
                            >
                                <option value="newest">Mới nhất</option>
                                <option value="mostfunded">Gây quỹ nhiều nhất</option>
                                <option value="trending">Tăng trưởng (% đạt)</option>
                            </select>
                        </div>

                        {/* Results Count */}
                        <div className="flex items-end">
                            <div className="w-full rounded-lg bg-blue-50 border border-blue-200 px-3 py-2">
                                <p className="text-sm font-medium text-blue-600">
                                    Tìm thấy {filteredCampaigns.length} chiến dịch
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
                {/* Campaign Grid */}
                <section className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {/* Loading State */}
                    {(isLoading || isOnChainLoading) && normalizedCampaigns.length === 0 &&
                        Array.from({ length: 6 }).map((_, index) => (
                            <CampaignCardSkeleton key={`skeleton-${index}`} />
                        ))}

                    {/* Error State */}
                    {!isLoading && !isOnChainLoading && error && normalizedCampaigns.length === 0 && (
                        <div className="col-span-full rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
                            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-100 mb-4">
                                <span className="text-2xl">⚠️</span>
                            </div>
                            <p className="text-lg font-semibold text-red-900 mb-2">Không thể tải chiến dịch</p>
                            <p className="text-sm text-red-700 mb-4">
                                {error || onChainError || "Có lỗi xảy ra. Vui lòng kiểm tra backend/on-chain RPC."}
                            </p>
                            <button
                                onClick={() => {
                                    refetch();
                                    refetchOnChain();
                                }}
                                className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 transition"
                            >
                                Thử lại
                            </button>
                        </div>
                    )}

                    {/* Empty State - No Campaigns */}
                    {!isLoading && !isOnChainLoading && !error && normalizedCampaigns.length === 0 && (
                        <div className="col-span-full rounded-2xl border border-blue-200 bg-blue-50 p-12 text-center">
                            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 mb-4">
                                <span className="text-3xl">🚀</span>
                            </div>
                            <p className="text-xl font-semibold text-slate-900 mb-2">Chưa có chiến dịch</p>
                            <p className="text-slate-600 mb-6">Hãy là người đầu tiên tạo chiến dịch gây quỹ trên blockchain.</p>
                            <Link
                                href="/campaigns/create"
                                className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition"
                            >
                                Tạo chiến dịch đầu tiên
                            </Link>
                        </div>
                    )}

                    {/* Empty State - No Search Results */}
                    {!isLoading && !isOnChainLoading && normalizedCampaigns.length > 0 && filteredCampaigns.length === 0 && (
                        <div className="col-span-full rounded-2xl border border-slate-200 bg-slate-50 p-12 text-center">
                            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 mb-4">
                                <span className="text-3xl">🔍</span>
                            </div>
                            <p className="text-xl font-semibold text-slate-900 mb-2">Không tìm thấy chiến dịch</p>
                            <p className="text-slate-600 mb-6">Hãy thử điều chỉnh bộ lọc hoặc từ khóa.</p>
                            <button
                                onClick={() => {
                                    setSearchQuery("");
                                    setFilterStatus("all");
                                }}
                                className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-slate-900 text-white font-semibold hover:bg-slate-800 transition"
                            >
                                Xóa bộ lọc
                            </button>
                        </div>
                    )}

                    {/* Campaign Cards */}
                    {!isLoading && !error && filteredCampaigns.length > 0 &&
                        filteredCampaigns.map((campaign) => {
                            const goalEth = Number(formatEther(campaign.goal));
                            const raisedEth = Number(formatEther(campaign.raised));
                            const progress = goalEth > 0 ? Math.min((raisedEth / goalEth) * 100, 100) : 0;
                            const isActive = !campaign.completed;

                            return (
                                <Link
                                    key={campaign.id}
                                    href={`/campaigns/${campaign.id}`}
                                    className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-200 hover:shadow-lg hover:-translate-y-1 hover:border-blue-300"
                                >
                                    {/* Campaign Header */}
                                    <div className="mb-4">
                                        <div className="flex items-start gap-3">
                                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-sm font-bold text-white shadow-lg">
                                                #{campaign.id}
                                            </div>
                                            <div className="min-w-0 flex-1 flex-col gap-1">
                                                <h3 className="line-clamp-2 text-lg font-bold leading-snug text-slate-900 group-hover:text-blue-600 transition">
                                                    {campaign.title || `Campimage.pngaign ${campaign.id}`}
                                                </h3>
                                                <p className="min-w-0 truncate text-xs text-slate-500">
                                                    by {campaign.creator.slice(0, 6)}...{campaign.creator.slice(-4)}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="mt-2 flex items-center  gap-2">

                                            <span
                                                className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold ${isActive
                                                    ? "bg-green-100 text-green-700"
                                                    : "bg-slate-100 text-slate-600"
                                                    }`}
                                            >
                                                {isActive ? "● Đang hoạt động" : "Đã kết thúc"}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Campaign Stats */}
                                    <div className="rounded-xl bg-slate-50 p-4 mb-4">
                                        <div className="grid grid-cols-2 gap-4 text-sm">
                                            <div>
                                                <p className="text-slate-600 mb-1">Mục tiêu</p>
                                                <p className="text-xl font-bold text-slate-900">
                                                    {formatEthAmount(goalEth)} <span className="text-sm font-normal text-slate-600">ETH</span>
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-slate-600 mb-1">Đã gây quỹ</p>
                                                <p className="text-xl font-bold text-blue-600">
                                                    {formatEthAmount(raisedEth)} <span className="text-sm font-normal text-slate-600">ETH</span>
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Progress Bar */}
                                    <div className="mb-4">
                                        <div className="flex items-center justify-between text-sm mb-2">
                                            <span className="font-medium text-slate-900">{progress.toFixed(1)}% đạt được</span>
                                            <span className="text-slate-600">{formatEthAmount(raisedEth)} / {formatEthAmount(goalEth)} ETH</span>
                                        </div>
                                        <div className="h-2.5 w-full rounded-full bg-slate-200 overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all duration-500 ${progress >= 100 ? "bg-green-500" : "bg-blue-600"
                                                    }`}
                                                style={{ width: `${progress}%` }}
                                            />
                                        </div>
                                    </div>

                                    {/* View Details Button */}
                                    <div className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-5 py-2.5 text-sm font-semibold text-slate-900 group-hover:bg-blue-600 group-hover:text-white transition-all duration-200">
                                        Xem chi tiết
                                        <span className="text-lg">→</span>
                                    </div>

                                    {/* On-chain Badge */}
                                    <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded">
                                            On-Chain ✓
                                        </span>
                                    </div>
                                </Link>
                            );
                        })}
                </section>

            </main>
        </div>
    );
}

const CampaignsPage = dynamic(async () => CampaignsPageContent, {
    ssr: false,
});

export default CampaignsPage;
