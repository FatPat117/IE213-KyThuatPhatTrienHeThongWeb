"use client";

import BackButton from "@/components/navigation/BackButton";
import {
    getCampaignMetadataFromCache,
    isPlaceholderCampaignDescription,
    isPlaceholderCampaignTitle,
    useBackendCampaigns,
    TERMINAL_STATUSES,
    SEPOLIA_CHAIN_ID,
    getPublicCampaignMilestones,
} from "@/lib";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { formatEther } from "viem";
import { useAccount, useChainId } from "wagmi";
import { showErrorToast } from "@/lib/ui/toast";

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

const ITEMS_PER_PAGE = 9;

function MyCampaignsPageContent() {
    const { data: campaigns, isLoading, error, refetch } = useBackendCampaigns();
    const { isConnected, address } = useAccount();
    const chainId = useChainId();
    const [searchQuery, setSearchQuery] = useState("");
    const [filterStatus, setFilterStatus] = useState<string>("all");
    const [sortBy, setSortBy] = useState<"newest" | "mostfunded" | "trending">("newest");
    const [currentPage, setCurrentPage] = useState(1);
    const [milestoneStatusByCampaignId, setMilestoneStatusByCampaignId] = useState<Record<number, string>>({});

    const isSepoliaNetwork = chainId === SEPOLIA_CHAIN_ID;
    const canCreateCampaign = isConnected && isSepoliaNetwork;

    useEffect(() => {
        if (!error) return;
        showErrorToast(error || "Có lỗi xảy ra khi tải dữ liệu từ backend.");
    }, [error]);

    const normalizedCampaigns = useMemo(
        () => {
            if (!address) return [];
            return campaigns
                .filter(c => c.creator.toLowerCase() === address.toLowerCase())
                .map((campaign) => {
                    const cached = getCampaignMetadataFromCache(campaign.onChainId);
                    const status = (campaign.status || "").toLowerCase();
                    return {
                        id: campaign.onChainId,
                        title: !isPlaceholderCampaignTitle(campaign.title, campaign.onChainId)
                            ? campaign.title
                            : (cached?.title || `Chiến dịch #${campaign.onChainId}`),
                        description: !isPlaceholderCampaignDescription(campaign.description)
                            ? campaign.description
                            : (cached?.description || "Dữ liệu đang được đồng bộ..."),
                        creator: campaign.creator,
                        goal: BigInt(campaign.goal || "0"),
                        raised: BigInt(campaign.raised || "0"),
                        status: campaign.status,
                        completed: TERMINAL_STATUSES.has(status),
                    };
                });
        },
        [campaigns, address]
    );

    // Fetch milestone statuses for owner context
    useEffect(() => {
        let cancelled = false;
        const loadMilestoneStatuses = async () => {
            if (!normalizedCampaigns.length) {
                setMilestoneStatusByCampaignId({});
                return;
            }

            const entries = await Promise.all(
                normalizedCampaigns.map(async (campaign) => {
                    try {
                        const milestoneData = await getPublicCampaignMilestones(campaign.id);
                        const m0 = milestoneData.milestones.find(item => item.milestoneId === 0);
                        const raw = (m0?.status || "").toLowerCase();
                        const isFunded = campaign.raised >= campaign.goal;

                        if (raw === "pending_verification" || raw === "submitted") {
                            return [campaign.id, "Chờ xác nhận"] as const;
                        }
                        if (raw === "pending_funding" && isFunded) {
                            return [campaign.id, "Đang thi công"] as const;
                        }
                        return [campaign.id, ""] as const;
                    } catch {
                        return [campaign.id, ""] as const;
                    }
                })
            );

            if (!cancelled) {
                setMilestoneStatusByCampaignId(
                    Object.fromEntries(entries.filter(([, value]) => Boolean(value)))
                );
            }
        };

        loadMilestoneStatuses();
        return () => { cancelled = true; };
    }, [normalizedCampaigns]);

    // Filter and search campaigns
    const filteredCampaigns = useMemo(() => {
        let result = [...normalizedCampaigns];

        // Apply status filter
        if (filterStatus !== "all") {
            const queryStatus = filterStatus.toLowerCase();
            if (queryStatus === "active") {
                result = result.filter(c => (c.status || "").toLowerCase() === "active");
            } else if (queryStatus === "ended") {
                result = result.filter(c => {
                    const s = (c.status || "").toLowerCase();
                    return s === "completed" || s === "success";
                });
            } else if (queryStatus === "failed") {
                result = result.filter(c => {
                    const s = (c.status || "").toLowerCase();
                    return s === "failed" || s === "partial_failed" || s === "cancelled" || s === "refunded";
                });
            } else {
                result = result.filter(c => (c.status || "").toLowerCase() === queryStatus);
            }
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
            result.sort((a, b) => {
                const aPercent = Number(a.goal) > 0 ? Number(a.raised) / Number(a.goal) : 0;
                const bPercent = Number(b.goal) > 0 ? Number(b.raised) / Number(b.goal) : 0;
                return bPercent - aPercent;
            });
        } else {
            result.sort((a, b) => b.id - a.id);
        }

        return result;
    }, [normalizedCampaigns, searchQuery, filterStatus, sortBy]);

    // Pagination
    const totalPages = Math.max(Math.ceil(filteredCampaigns.length / ITEMS_PER_PAGE), 1);
    const safePage = Math.min(currentPage, totalPages);
    const paginatedCampaigns = useMemo(
        () => filteredCampaigns.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE),
        [filteredCampaigns, safePage]
    );


    if (!isConnected) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white text-slate-900">
                <main className="mx-auto w-full max-w-7xl px-6 py-12 md:px-10">
                    <div className="rounded-2xl border-2 border-slate-200 bg-slate-50 p-12 text-center shadow-inner">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 mb-4 text-3xl">
                            🔌
                        </div>
                        <h2 className="text-2xl font-bold text-slate-900 mb-3">Chưa kết nối ví</h2>
                        <p className="text-slate-600 mb-6">Vui lòng kết nối ví để xem và quản lý các chiến dịch của bạn.</p>
                        <Link
                            href="/"
                            className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition shadow-md"
                        >
                            Về trang chủ
                        </Link>
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white text-slate-900">
            <main className="mx-auto w-full max-w-7xl px-6 py-12 md:px-10">
                <div className="mb-6">
                    <BackButton fallbackHref="/" />
                </div>

                {!isSepoliaNetwork && isConnected && (
                    <div className="mb-6 rounded-lg border border-red-300 bg-red-50 p-4">
                        <p className="text-sm font-semibold text-red-900">⚠️ Mạng lưới không khớp</p>
                        <p className="text-xs text-red-800 mt-1">
                            Vui lòng chuyển sang mạng Sepolia để quản lý chiến dịch của bạn.
                        </p>
                    </div>
                )}

                {/* Page Header */}
                <header className="flex flex-col gap-6 mb-10">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                            <div className="inline-flex items-center gap-2 mb-3">
                                <span className="text-xs font-semibold text-indigo-600 bg-indigo-100 px-3 py-1 rounded-full">
                                    👤 Chủ sở hữu
                                </span>
                            </div>
                            <h1 className="text-4xl font-bold text-slate-900 mb-3">Chiến dịch của tôi</h1>
                            <p className="text-lg text-slate-600">
                                Quản lý và theo dõi tiến độ các chiến dịch bạn đã khởi tạo
                            </p>
                        </div>
                        <div className="flex items-center gap-3 flex-wrap">
                            <button
                                onClick={() => refetch()}
                                className="inline-flex items-center justify-center px-5 py-3 rounded-lg border-2 border-slate-200 text-slate-900 font-semibold hover:border-blue-600 hover:text-blue-600 transition duration-200"
                            >
                                🔄 Tải lại
                            </button>
                            <Link
                                href="/campaigns/create"
                                className={`inline-flex items-center justify-center px-5 py-3 rounded-lg font-semibold transition duration-200 shadow-lg hover:shadow-xl ${
                                    canCreateCampaign
                                    ? "bg-blue-600 text-white hover:bg-blue-700"
                                    : "bg-slate-300 text-slate-600 cursor-not-allowed"
                                }`}
                            >
                                + Tạo chiến dịch mới
                            </Link>
                        </div>
                    </div>

                    {/* Stats Summary */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="rounded-xl bg-white border border-slate-200 p-4 shadow-sm">
                            <p className="text-sm font-medium text-slate-600">Bạn đã tạo</p>
                            <p className="text-2xl font-bold text-slate-900 mt-1">
                                {isLoading ? "..." : normalizedCampaigns.length}
                            </p>
                        </div>
                        <div className="rounded-xl bg-white border border-slate-200 p-4 shadow-sm">
                            <p className="text-sm font-medium text-slate-600">Đang hoạt động</p>
                            <p className="text-2xl font-bold text-emerald-600 mt-1">
                                {isLoading ? "..." : normalizedCampaigns.filter((c) => !c.completed).length}
                            </p>
                        </div>
                        <div className="rounded-xl bg-white border border-slate-200 p-4 shadow-sm">
                            <p className="text-sm font-medium text-slate-600">Đã kết thúc</p>
                            <p className="text-2xl font-bold text-slate-600 mt-1">
                                {isLoading ? "..." : normalizedCampaigns.filter((c) => c.completed).length}
                            </p>
                        </div>
                        <div className="rounded-xl bg-white border border-slate-200 p-4 shadow-sm">
                            <p className="text-sm font-medium text-slate-600">Địa chỉ ví</p>
                            <p className="text-sm font-bold text-slate-900 mt-1 truncate" title={address}>
                                {address?.slice(0, 6)}...{address?.slice(-4)}
                            </p>
                        </div>
                    </div>
                </header>

                {/* Search and Filter Bar */}
                <div className="mb-8 space-y-4">
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="🔍 Tìm kiếm trong chiến dịch của bạn..."
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="w-full rounded-lg border-2 border-slate-200 bg-white px-4 py-3 text-slate-900 placeholder-slate-400 focus:border-blue-600 focus:outline-none transition"
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="text-xs font-semibold text-slate-600 mb-2 block">Trạng thái</label>
                            <select
                                value={filterStatus}
                                onChange={(e) => {
                                    setFilterStatus(e.target.value);
                                    setCurrentPage(1);
                                }}
                                className="w-full rounded-lg border-2 border-slate-200 bg-white px-3 py-2 text-slate-900 focus:border-blue-600 focus:outline-none transition"
                            >
                                <option value="all">Tất cả trạng thái</option>
                                <option value="active">🟢 Đang gây quỹ</option>
                                <option value="pending_approval">⏳ Chờ duyệt</option>
                                <option value="in_progress">🔵 Đang triển khai</option>
                                <option value="failed">❌ Thất bại / Bị từ chối</option>
                                <option value="ended">  Thành công</option>
                            </select>
                        </div>

                        <div>
                            <label className="text-xs font-semibold text-slate-600 mb-2 block">Sắp xếp theo</label>
                            <select
                                value={sortBy}
                                onChange={(e) => {
                                    setSortBy(e.target.value as any);
                                    setCurrentPage(1);
                                }}
                                className="w-full rounded-lg border-2 border-slate-200 bg-white px-3 py-2 text-slate-900 focus:border-blue-600 focus:outline-none transition"
                            >
                                <option value="newest">Mới nhất</option>
                                <option value="mostfunded">Gây quỹ nhiều nhất</option>
                                <option value="trending">% Hoàn thành cao nhất</option>
                            </select>
                        </div>

                        <div className="flex items-end">
                            <div className="w-full rounded-lg bg-indigo-50 border border-indigo-200 px-3 py-2">
                                <p className="text-sm font-medium text-indigo-600">
                                    Tìm thấy {filteredCampaigns.length} chiến dịch
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Campaign Grid */}
                <section className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {isLoading && normalizedCampaigns.length === 0 &&
                        Array.from({ length: 6 }).map((_, index) => (
                            <CampaignCardSkeleton key={`skeleton-${index}`} />
                        ))}

                    {!isLoading && normalizedCampaigns.length === 0 && (
                        <div className="col-span-full rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-12 text-center">
                            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 mb-4 text-3xl">
                                📝
                            </div>
                            <p className="text-xl font-semibold text-slate-900 mb-2">Bạn chưa tạo chiến dịch nào</p>
                            <p className="text-slate-600 mb-6">Bắt đầu hành trình gây quỹ của bạn ngay hôm nay!</p>
                            <Link
                                href="/campaigns/create"
                                className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition"
                            >
                                Tạo chiến dịch đầu tiên
                            </Link>
                        </div>
                    )}

                    {!isLoading && normalizedCampaigns.length > 0 && filteredCampaigns.length === 0 && (
                        <div className="col-span-full rounded-2xl border border-slate-200 bg-slate-50 p-12 text-center">
                            <p className="text-xl font-semibold text-slate-900 mb-2">Không tìm thấy kết quả</p>
                            <p className="text-slate-600 mb-6">Hãy thử thay đổi bộ lọc hoặc từ khóa tìm kiếm.</p>
                            <button
                                onClick={() => { setSearchQuery(""); setFilterStatus("all"); }}
                                className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-slate-900 text-white font-semibold hover:bg-slate-800 transition"
                            >
                                Xóa bộ lọc
                            </button>
                        </div>
                    )}

                    {paginatedCampaigns.map((campaign) => {
                        const goalEth = Number(formatEther(campaign.goal));
                        const raisedEth = Number(formatEther(campaign.raised));
                        const progress = goalEth > 0 ? Math.min((raisedEth / goalEth) * 100, 100) : 0;
                        const normalizedStatus = (campaign.status || "").toLowerCase();
                        const isPendingApproval = normalizedStatus === "pending_approval";
                        const isInProgress = normalizedStatus === "in_progress";
                        const isActive = !campaign.completed && !isPendingApproval;
                        const isFailed = ["failed", "partial_failed", "cancelled", "refunded"].includes(normalizedStatus);
                        const isSuccess = campaign.completed && !isFailed;

                        let statusClasses = "bg-slate-100 text-slate-700 border-slate-200";
                        if (isPendingApproval) statusClasses = "bg-amber-50 text-amber-700 border-amber-200";
                        else if (isFailed) statusClasses = "bg-red-50 text-red-700 border-red-200";
                        else if (isInProgress) statusClasses = "bg-blue-50 text-blue-700 border-blue-200";
                        else if (isActive) statusClasses = "bg-emerald-50 text-emerald-700 border-emerald-200";
                        else if (isSuccess) statusClasses = "bg-green-50 text-green-700 border-green-200";

                        let progressBarColor = "bg-slate-400";
                        if (isFailed) progressBarColor = "bg-red-500";
                        else if (isInProgress) progressBarColor = "bg-blue-500";
                        else if (isActive) progressBarColor = "bg-emerald-500";
                        else if (isSuccess) progressBarColor = "bg-green-500";

                        const mStatus = milestoneStatusByCampaignId[campaign.id];

                        return (
                            <div key={campaign.id} className="flex flex-col h-full rounded-xl border border-slate-200 bg-white shadow-sm transition-all duration-200 hover:shadow-md group">
                                <div className="p-5 flex-1 flex flex-col">
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 font-bold text-xs">
                                            #{campaign.id}
                                        </div>
                                        <div className="flex flex-col items-end gap-1">
                                            <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${statusClasses}`}>
                                                {isPendingApproval ? "Chờ duyệt" :
                                                 normalizedStatus === "cancelled" ? "Bị từ chối" :
                                                 isFailed ? "Thất bại" :
                                                 isInProgress ? "Đang triển khai" :
                                                 isActive ? "Đang gây quỹ" : "Thành công"}
                                            </span>
                                            {mStatus && (
                                                <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                                                    M0: {mStatus}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <h3 className="text-lg font-bold text-slate-900 mb-2 line-clamp-2 min-h-[3.5rem]">
                                        {campaign.title}
                                    </h3>

                                    <p className="text-sm text-slate-600 mb-6 line-clamp-3 flex-1">
                                        {campaign.description}
                                    </p>

                                    <div className="space-y-4 mb-6">
                                        <div>
                                            <div className="flex justify-between text-xs font-medium text-slate-500 mb-1">
                                                <span>{progress.toFixed(1)}% hoàn thành</span>
                                                <span>{formatEthAmount(raisedEth)} / {formatEthAmount(goalEth)} ETH</span>
                                            </div>
                                            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full transition-all duration-500 ${progressBarColor}`}
                                                    style={{ width: `${progress}%` }}
                                                />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="bg-slate-50 p-2 rounded-lg">
                                                <p className="text-[10px] text-slate-500 uppercase font-bold">Đã góp</p>
                                                <p className="text-sm font-bold text-slate-900">{formatEthAmount(raisedEth)} ETH</p>
                                            </div>
                                            <div className="bg-slate-50 p-2 rounded-lg">
                                                <p className="text-[10px] text-slate-500 uppercase font-bold">Mục tiêu</p>
                                                <p className="text-sm font-bold text-slate-900">{formatEthAmount(goalEth)} ETH</p>
                                            </div>
                                        </div>
                                    </div>

                                    <Link
                                        href={`/campaigns/${campaign.id}`}
                                        className="inline-flex w-full items-center justify-center rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-blue-600 shadow-sm"
                                    >
                                        Quản lý chiến dịch
                                    </Link>
                                </div>
                            </div>
                        );
                    })}
                </section>

                {/* Pagination Controls */}
                {!isLoading && filteredCampaigns.length > ITEMS_PER_PAGE && (
                    <div className="mt-10 flex items-center justify-center gap-2">
                        <button
                            onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                            disabled={safePage === 1}
                            className="h-10 px-4 rounded-lg border border-slate-200 bg-white text-slate-600 hover:border-blue-600 hover:text-blue-600 disabled:opacity-50 transition"
                        >
                            Trước
                        </button>
                        <span className="text-sm font-medium text-slate-600 px-4">
                            Trang {safePage} / {totalPages}
                        </span>
                        <button
                            onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                            disabled={safePage === totalPages}
                            className="h-10 px-4 rounded-lg border border-slate-200 bg-white text-slate-600 hover:border-blue-600 hover:text-blue-600 disabled:opacity-50 transition"
                        >
                            Sau
                        </button>
                    </div>
                )}
            </main>
        </div>
    );
}

const MyCampaignsPage = dynamic(async () => MyCampaignsPageContent, {
    ssr: false,
});

export default MyCampaignsPage;
