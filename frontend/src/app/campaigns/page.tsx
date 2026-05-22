'use client';

import CampaignGridCard, {
    CampaignGridCardSkeleton,
} from "@/components/campaigns/CampaignGridCard";
import CampaignListRow, {
    CampaignListRowSkeleton,
} from "@/components/campaigns/CampaignListRow";
import BackButton from "@/components/navigation/BackButton";
import { useBackendCampaigns, SEPOLIA_CHAIN_ID } from "@/lib";
import {
    BTN_PRIMARY,
    normalizeCampaignListItem,
} from "@/lib/utils/campaign-display";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAccount, useChainId } from "wagmi";
import { showErrorToast } from "@/lib/ui/toast";

const ITEMS_PER_PAGE = 8;

function CampaignsPageContent() {
    const { data: campaigns, isLoading, error, refetch } = useBackendCampaigns();
    const { isConnected } = useAccount();
    const chainId = useChainId();
    const [searchQuery, setSearchQuery] = useState("");
    const [filterStatus, setFilterStatus] = useState<string>("active");
    const [sortBy, setSortBy] = useState<"newest" | "mostfunded" | "trending">("newest");
    const [currentPage, setCurrentPage] = useState(1);
    const [viewMode, setViewMode] = useState<"list" | "grid">("list");
    const isSepoliaNetwork = chainId === SEPOLIA_CHAIN_ID;
    const canCreateCampaign = isConnected && isSepoliaNetwork;

    useEffect(() => {
        if (!error) return;
        showErrorToast(error || "Có lỗi xảy ra khi tải dữ liệu từ backend.");
    }, [error]);

    const normalizedCampaigns = useMemo(
        () => campaigns.map(normalizeCampaignListItem),
        [campaigns],
    );

    // Filter and search campaigns
    const filteredCampaigns = useMemo(() => {
        let result = [...normalizedCampaigns];

        // Apply status filter
        if (filterStatus !== "all") {
            const queryStatus = filterStatus.toLowerCase();
            if (queryStatus === "active") {
                // Chỉ lấy các chiến dịch đang trong giai đoạn gọi vốn (status chính xác là active)
                result = result.filter(c => (c.status || "").toLowerCase() === "active");
            } else if (queryStatus === "ended") {
                // Chỉ lấy các chiến dịch đã kết thúc thành công
                result = result.filter(c => {
                    const s = (c.status || "").toLowerCase();
                    return s === "completed" || s === "success";
                });
            } else if (queryStatus === "failed") {
                // Các chiến dịch thất bại hoặc bị dừng
                result = result.filter(c => {
                    const s = (c.status || "").toLowerCase();
                    return s === "failed" || s === "partial_failed" || s === "cancelled" || s === "refunded";
                });
            } else {
                // Khớp chính xác cho các trạng thái khác (in_progress, pending_approval)
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

    // Pagination derived values
    const totalPages = Math.max(Math.ceil(filteredCampaigns.length / ITEMS_PER_PAGE), 1);
    const safePage = Math.min(currentPage, totalPages);
    const paginatedCampaigns = useMemo(
        () => filteredCampaigns.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE),
        [filteredCampaigns, safePage]
    );


    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white text-slate-900">
            <main className="mx-auto w-full max-w-7xl px-6 py-12 md:px-10">
                {/* Back Button */}
                <div className="mb-6">
                    <BackButton fallbackHref="/" />
                </div>

                {/* Status Bar */}
                {!isConnected && (
                    <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
                        <p className="text-sm font-semibold text-blue-900">
                            Chế độ xem (chỉ đọc)
                        </p>
                        <p className="mt-1 text-sm text-blue-800">
                            Kết nối ví để tạo chiến dịch và quyên góp.
                        </p>
                    </div>
                )}

                {isConnected && !isSepoliaNetwork && (
                    <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                        <p className="text-sm font-semibold text-red-900">
                            Mạng lưới chưa đúng
                        </p>
                        <p className="mt-1 text-sm text-red-800">
                            Vui lòng chuyển sang mạng Sepolia để tạo chiến dịch hoặc quyên góp.
                        </p>
                    </div>
                )}

                {/* Page Header */}
                <header className="flex flex-col gap-6 mb-10">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                            <div className="inline-flex items-center gap-2 mb-3">
                                <span className="text-xs font-semibold text-blue-700 bg-blue-100 px-3 py-1 rounded-full">
                                    Dữ liệu on-chain
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
                                }}
                                className="inline-flex items-center justify-center px-5 py-3 rounded-lg border-2 border-slate-200 text-slate-900 font-semibold hover:border-blue-600 hover:text-blue-600 transition duration-200"
                            >
                                Tải lại
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
                                {isLoading ? "..." : normalizedCampaigns.length}
                            </p>
                        </div>
                        <div className="rounded-xl bg-white border border-slate-200 p-4 shadow-sm">
                            <p className="text-sm font-medium text-slate-600">Đang hoạt động</p>
                            <p className="text-2xl font-bold text-green-600 mt-1">
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
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="🔍 Tìm theo tiêu đề hoặc mô tả..."
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="w-full rounded-lg border-2 border-slate-200 bg-white px-4 py-3 text-slate-900 placeholder-slate-400 focus:border-blue-600 focus:outline-none transition"
                        />
                    </div>

                    <div className="flex flex-col gap-[12px] lg:flex-row lg:flex-wrap lg:items-end">
                        <div className="flex min-w-0 flex-1 flex-col gap-[12px] sm:flex-row sm:flex-wrap sm:items-end">
                            <div className="min-w-[140px] flex-1 sm:max-w-[200px]">
                                <label className="mb-2 block text-xs font-semibold text-slate-600">
                                    Trạng thái
                                </label>
                                <select
                                    value={filterStatus}
                                    onChange={(e) => {
                                        setFilterStatus(e.target.value);
                                        setCurrentPage(1);
                                    }}
                                    aria-label="Lọc theo trạng thái chiến dịch"
                                    className="w-full rounded-lg border-2 border-slate-200 bg-white px-3 py-2 text-slate-900 focus:border-blue-600 focus:outline-none transition"
                                >
                                    <option value="all">Tất cả</option>
                                    <option value="active">Đang gây quỹ (Hoạt động)</option>
                                    <option value="pending_approval">Chờ duyệt</option>
                                    <option value="in_progress">Đang triển khai</option>
                                    <option value="failed">Thất bại / Bị từ chối</option>
                                    <option value="ended">Chiến dịch thành công</option>
                                </select>
                            </div>

                            <div className="min-w-[140px] flex-1 sm:max-w-[200px]">
                                <label className="mb-2 block text-xs font-semibold text-slate-600">
                                    Sắp xếp
                                </label>
                                <select
                                    value={sortBy}
                                    onChange={(e) => {
                                        setSortBy(
                                            e.target.value as
                                                | "newest"
                                                | "mostfunded"
                                                | "trending",
                                        );
                                        setCurrentPage(1);
                                    }}
                                    aria-label="Sắp xếp danh sách chiến dịch"
                                    className="w-full rounded-lg border-2 border-slate-200 bg-white px-3 py-2 text-slate-900 focus:border-blue-600 focus:outline-none transition"
                                >
                                    <option value="newest">Mới nhất</option>
                                    <option value="mostfunded">Gây quỹ nhiều nhất</option>
                                    <option value="trending">Tăng trưởng (% đạt)</option>
                                </select>
                            </div>

                            <div
                                className="campaigns-result-pill flex items-center"
                                aria-live="polite"
                            >
                                Tìm thấy {filteredCampaigns.length} chiến dịch
                                {filteredCampaigns.length > 0 && (
                                    <span className="ml-1 font-normal opacity-80">
                                        · trang {safePage}/{totalPages}
                                    </span>
                                )}
                            </div>
                        </div>

                        <div
                            className="flex shrink-0 items-center gap-1 self-end lg:ml-auto"
                            role="group"
                            aria-label="Chế độ hiển thị"
                        >
                            <button
                                type="button"
                                onClick={() => setViewMode("list")}
                                className={`view-toggle-btn ${viewMode === "list" ? "view-toggle-btn-active" : "view-toggle-btn-inactive"}`}
                                aria-pressed={viewMode === "list" ? "true" : "false"}
                            >
                                <span aria-hidden>≡</span> Danh sách
                            </button>
                            <button
                                type="button"
                                onClick={() => setViewMode("grid")}
                                className={`view-toggle-btn ${viewMode === "grid" ? "view-toggle-btn-active" : "view-toggle-btn-inactive"}`}
                                aria-pressed={viewMode === "grid" ? "true" : "false"}
                            >
                                <span aria-hidden>⊞</span> Lưới
                            </button>
                        </div>
                    </div>
                </div>
                <section
                    className={
                        viewMode === "grid"
                            ? "campaigns-page-grid"
                            : "flex flex-col gap-5"
                    }
                >
                    {isLoading && normalizedCampaigns.length === 0 &&
                        Array.from({ length: 4 }).map((_, index) =>
                            viewMode === "grid" ? (
                                <CampaignGridCardSkeleton
                                    key={`skeleton-${index}`}
                                />
                            ) : (
                                <CampaignListRowSkeleton
                                    key={`skeleton-${index}`}
                                />
                            ),
                        )}

                    {/* Error State */}
                    {!isLoading && error && normalizedCampaigns.length === 0 && (
                        <div className="w-full rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
                            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-100 mb-4 text-red-600 font-bold">
                                !
                            </div>
                            <p className="text-lg font-semibold text-red-900 mb-2">Không thể tải chiến dịch</p>
                            <p className="text-sm text-red-700 mb-4">
                                Đã xảy ra lỗi tải dữ liệu chiến dịch.
                            </p>
                            <button
                                onClick={() => {
                                    refetch();
                                }}
                                className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 transition"
                            >
                                Thử lại
                            </button>
                        </div>
                    )}

                    {!isLoading && !error && normalizedCampaigns.length === 0 && (
                        <div className="col-span-full flex flex-col items-center justify-center rounded-2xl border border-[var(--border-glow)] bg-[rgba(13,20,38,0.6)] px-8 py-16 text-center">
                            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl border border-[rgba(99,102,241,0.35)] bg-[rgba(99,102,241,0.12)] text-[var(--accent-cyan)]">
                                <svg
                                    className="h-10 w-10"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    aria-hidden
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={1.5}
                                        d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                                    />
                                </svg>
                            </div>
                            <h2 className="font-display text-2xl font-bold text-[var(--text-primary)]">
                                Chưa có chiến dịch nào
                            </h2>
                            <p className="mt-2 max-w-md text-[var(--text-secondary)]">
                                Hãy là người đầu tiên tạo chiến dịch!
                            </p>
                            {canCreateCampaign ? (
                                <Link
                                    href="/campaigns/create"
                                    className={`${BTN_PRIMARY} mt-8 inline-flex items-center gap-2`}
                                >
                                    Tạo chiến dịch →
                                </Link>
                            ) : (
                                <p className="mt-6 text-sm text-[var(--text-secondary)]">
                                    Kết nối ví Sepolia để tạo chiến dịch.
                                </p>
                            )}
                        </div>
                    )}

                    {/* Empty State - No Search Results */}
                    {!isLoading && normalizedCampaigns.length > 0 && filteredCampaigns.length === 0 && (
                        <div className="col-span-full w-full rounded-2xl border border-slate-200 bg-slate-50 p-12 text-center">
                            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 mb-4 text-2xl text-slate-500">
                                …
                            </div>
                            <p className="text-xl font-semibold text-slate-900 mb-2">Không tìm thấy chiến dịch</p>
                            <p className="text-slate-600 mb-6">Hãy thử điều chỉnh bộ lọc hoặc từ khóa.</p>
                            <button
                                onClick={() => {
                                    setSearchQuery("");
                                    setFilterStatus("active");
                                }}
                                className={BTN_PRIMARY}
                            >
                                Xóa bộ lọc
                            </button>
                        </div>
                    )}

                    {!isLoading &&
                        !error &&
                        paginatedCampaigns.length > 0 &&
                        (viewMode === "grid"
                            ? paginatedCampaigns.map((campaign) => (
                                  <CampaignGridCard
                                      key={campaign.id}
                                      campaign={campaign}
                                  />
                              ))
                            : paginatedCampaigns.map((campaign) => (
                                  <CampaignListRow
                                      key={campaign.id}
                                      campaign={campaign}
                                  />
                              )))}
                </section>

                {/* Pagination Controls */}
                {!isLoading && filteredCampaigns.length > ITEMS_PER_PAGE && (
                    <div className="mt-10 flex items-center justify-center gap-2">
                        {/* First page */}
                        <button
                            onClick={() => setCurrentPage(1)}
                            disabled={safePage === 1}
                            aria-label="Trang đầu"
                            className="flex h-9 w-9 items-center justify-center rounded-lg border-2 border-slate-200 bg-white text-slate-600 font-semibold text-sm transition hover:border-blue-600 hover:text-blue-600 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            «
                        </button>

                        {/* Previous page */}
                        <button
                            onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                            disabled={safePage === 1}
                            aria-label="Trang trước"
                            className="flex h-9 w-9 items-center justify-center rounded-lg border-2 border-slate-200 bg-white text-slate-600 font-semibold text-sm transition hover:border-blue-600 hover:text-blue-600 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            ‹
                        </button>

                        {/* Page numbers */}
                        {Array.from({ length: totalPages }, (_, i) => i + 1)
                            .filter(p =>
                                p === 1 ||
                                p === totalPages ||
                                Math.abs(p - safePage) <= 1
                            )
                            .reduce<(number | "...")[]>((acc, p, idx, arr) => {
                                if (idx > 0 && (p as number) - (arr[idx - 1] as number) > 1) {
                                    acc.push("...");
                                }
                                acc.push(p);
                                return acc;
                            }, [])
                            .map((item, idx) =>
                                item === "..." ? (
                                    <span
                                        key={`ellipsis-${idx}`}
                                        className="flex h-9 w-9 items-center justify-center text-slate-400 text-sm select-none"
                                    >
                                        …
                                    </span>
                                ) : (
                                    <button
                                        key={item}
                                        onClick={() => setCurrentPage(item as number)}
                                        aria-label={`Trang ${item}`}
                                        aria-current={item === safePage ? "page" : undefined}
                                        className={`flex h-9 w-9 items-center justify-center rounded-lg border-2 text-sm font-semibold transition ${
                                            item === safePage
                                                ? "border-blue-600 bg-blue-600 text-white shadow-md"
                                                : "border-slate-200 bg-white text-slate-700 hover:border-blue-600 hover:text-blue-600"
                                        }`}
                                    >
                                        {item}
                                    </button>
                                )
                            )
                        }

                        {/* Next page */}
                        <button
                            onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                            disabled={safePage === totalPages}
                            aria-label="Trang sau"
                            className="flex h-9 w-9 items-center justify-center rounded-lg border-2 border-slate-200 bg-white text-slate-600 font-semibold text-sm transition hover:border-blue-600 hover:text-blue-600 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            ›
                        </button>

                        {/* Last page */}
                        <button
                            onClick={() => setCurrentPage(totalPages)}
                            disabled={safePage === totalPages}
                            aria-label="Trang cuối"
                            className="flex h-9 w-9 items-center justify-center rounded-lg border-2 border-slate-200 bg-white text-slate-600 font-semibold text-sm transition hover:border-blue-600 hover:text-blue-600 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            »
                        </button>
                    </div>
                )}

            </main>
        </div>
    );
}

const CampaignsPage = dynamic(async () => CampaignsPageContent, {
    ssr: false,
});

export default CampaignsPage;
