"use client";

import Link from "next/link";
import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type CSSProperties,
} from "react";
import CampaignListRow, {
    CampaignListRowSkeleton,
} from "@/components/campaigns/CampaignListRow";
import FeaturedCampaignCard, {
    FeaturedCampaignCardSkeleton,
} from "@/components/campaigns/FeaturedCampaignCard";
import {
    getDisbursedMilestoneCount,
    useBackendCampaigns,
    useContractStats,
} from "@/lib";
import { normalizeCampaignListItem } from "@/lib/utils/campaign-display";
import { useWalletStatus } from "@/lib";

function CountUpNumber({
    value,
    decimals = 0,
    className = "",
    style,
}: {
    value: number;
    decimals?: number;
    className?: string;
    style?: CSSProperties;
}) {
    const ref = useRef<HTMLParagraphElement>(null);
    const [display, setDisplay] = useState(0);
    const lastAnimatedTarget = useRef<number | null>(null);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;

        const runCountUp = () => {
            if (lastAnimatedTarget.current === value) return;
            lastAnimatedTarget.current = value;
            const start = performance.now();
            const duration = 900;
            const from = 0;
            const to = value;

            const tick = (now: number) => {
                const progress = Math.min((now - start) / duration, 1);
                const eased = 1 - Math.pow(1 - progress, 3);
                setDisplay(from + (to - from) * eased);
                if (progress < 1) requestAnimationFrame(tick);
            };

            requestAnimationFrame(tick);
        };

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) runCountUp();
            },
            { threshold: 0.35 },
        );

        observer.observe(el);
        if (el.getBoundingClientRect().top < window.innerHeight) {
            runCountUp();
        }
        return () => observer.disconnect();
    }, [value]);

    const formatted =
        decimals > 0 ? display.toFixed(decimals) : String(Math.round(display));

    return (
        <p ref={ref} className={className} style={style}>
            {formatted}
        </p>
    );
}

/**
 * Hiển thị thống kê contract
 * Cho phép xem dữ liệu ở chế độ read-only
 */
export function ContractStatsDisplay() {
    const { campaignCount, totalRaised, isLoading, isError, errors, refetch } =
        useContractStats();
    const { isConnected } = useWalletStatus();
    const [disbursedMilestones, setDisbursedMilestones] = useState(0);
    const [isRefreshingMilestones, setIsRefreshingMilestones] = useState(false);
    const [milestoneError, setMilestoneError] = useState<string | null>(null);
    const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
    const lastUpdatedAtRef = useRef<string | null>(null);

    useEffect(() => {
        lastUpdatedAtRef.current = lastUpdatedAt;
    }, [lastUpdatedAt]);

    const isMilestoneRateLimited = useCallback((error: unknown) => {
        if (!(error instanceof Error)) return false;
        const normalized = error.message.toLowerCase();
        return (
            normalized.includes("rate limit") ||
            normalized.includes("too many requests")
        );
    }, []);

    const getMilestoneErrorMessage = useCallback((error: unknown) => {
        const fallback = "Không thể tải số mốc đã giải ngân";
        if (!(error instanceof Error)) return fallback;

        const normalized = error.message.toLowerCase();
        if (
            normalized.includes("rate limit") ||
            normalized.includes("too many requests")
        ) {
            return "API milestones đang quá tải. Hệ thống đang giữ số liệu lần cập nhật gần nhất, vui lòng thử lại sau ít phút.";
        }

        if (
            normalized.includes("failed to fetch") ||
            normalized.includes("network") ||
            normalized.includes("timeout")
        ) {
            return "Không kết nối được tới API milestones. Vui lòng kiểm tra mạng và thử lại.";
        }

        return fallback;
    }, []);

    const refreshMilestones = useCallback(async () => {
        try {
            setIsRefreshingMilestones(true);
            setMilestoneError(null);
            const disbursedCount = await getDisbursedMilestoneCount();
            setDisbursedMilestones(disbursedCount);
            setLastUpdatedAt(new Date().toLocaleTimeString("vi-VN"));
        } catch (error) {
            if (isMilestoneRateLimited(error) && lastUpdatedAtRef.current) {
                return;
            }
            setMilestoneError(getMilestoneErrorMessage(error));
        } finally {
            setIsRefreshingMilestones(false);
        }
    }, [getMilestoneErrorMessage, isMilestoneRateLimited]);

    useEffect(() => {
        refreshMilestones();
        const interval = setInterval(() => {
            refreshMilestones();
        }, 60_000);

        return () => clearInterval(interval);
    }, [refreshMilestones]);

    if (isLoading) {
        return (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-xl border-t-2 border-[var(--accent-primary)] bg-[rgba(99,102,241,0.06)] p-6">
                    <p className="mb-2 text-sm font-medium text-[var(--accent-primary)]">
                        Tổng chiến dịch
                    </p>
                    <div className="h-10 w-20 animate-pulse rounded bg-[rgba(99,102,241,0.2)]" />
                </div>
                <div className="rounded-xl border-t-2 border-[var(--accent-cyan)] bg-[rgba(6,182,212,0.06)] p-6">
                    <p className="mb-2 text-sm font-medium text-[var(--accent-cyan)]">
                        Tổng ETH đã gây quỹ
                    </p>
                    <div className="h-10 w-28 animate-pulse rounded bg-[rgba(6,182,212,0.2)]" />
                </div>
            </div>
        );
    }

    if (isError) {
        return (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-6">
                <p className="mb-2 text-sm font-semibold text-red-300">
                    Không thể tải dữ liệu
                </p>
                <ul className="mb-4 space-y-1 text-xs text-red-200/90">
                    {errors.map((error, idx) => (
                        <li key={idx}>• {error || "Có lỗi xảy ra"}</li>
                    ))}
                </ul>
                <button
                    onClick={() => refetch()}
                    className="rounded-lg border border-red-400/50 bg-red-500/20 px-3 py-1 text-xs text-red-200 transition hover:bg-red-500/30"
                >
                    Thử lại
                </button>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {!isConnected && (
                <div className="rounded-lg border border-[var(--border-glow)] bg-[rgba(99,102,241,0.06)] p-3 text-xs text-[var(--text-secondary)] md:col-span-2">
                    Bạn đang ở chế độ xem (read-only). Kết nối ví để mở khóa các
                    thao tác giao dịch.
                </div>
            )}
            <div className="rounded-xl border-t-2 border-[var(--accent-primary)] bg-[rgba(99,102,241,0.06)] p-6">
                <p className="mb-2 text-sm font-medium text-[var(--accent-primary)]">
                    Tổng chiến dịch
                </p>
                <CountUpNumber
                    value={campaignCount}
                    className="font-display text-4xl font-bold text-[var(--accent-primary)]"
                    style={{ textShadow: "0 0 24px rgba(99,102,241,0.35)" }}
                />
                <p className="mt-2 text-xs text-[var(--text-secondary)]">
                    Chiến dịch đang được ghi nhận on-chain
                </p>
            </div>

            <div className="rounded-xl border-t-2 border-[var(--accent-cyan)] bg-[rgba(6,182,212,0.06)] p-6">
                <p className="mb-2 text-sm font-medium text-[var(--accent-cyan)]">
                    Tổng ETH đã gây quỹ
                </p>
                <CountUpNumber
                    value={totalRaised}
                    decimals={4}
                    className="font-mono-data text-4xl font-bold text-[var(--accent-cyan)]"
                    style={{ textShadow: "0 0 24px rgba(6,182,212,0.35)" }}
                />
                <p className="mt-2 text-xs text-[var(--text-secondary)]">
                    Tổng hợp tất cả chiến dịch
                </p>
            </div>
        </div>
    );
}

/**
 * Danh sách chiến dịch (read-only)
 * @param limit - Số lượng chiến dịch tối đa hiển thị (0 = không giới hạn)
 * @param onlyActive - Chỉ hiển thị chiến dịch đang hoạt động (chưa completed)
 */
export function CampaignListDisplay({
    limit = 0,
    onlyActive = false,
}: {
    limit?: number;
    onlyActive?: boolean;
} = {}) {
    const {
        data: backendCampaigns,
        isLoading: isBackendLoading,
        error: backendError,
        refetch: refetchBackend,
    } = useBackendCampaigns();

    const campaigns = useMemo(() => {
        const result = backendCampaigns.map(normalizeCampaignListItem);

        let filtered = [...result].sort((a, b) => b.id - a.id);

        if (onlyActive) {
            filtered = filtered.filter(
                (c) => (c.status || "").toLowerCase() === "active",
            );
        }

        if (limit > 0) {
            filtered = filtered.slice(0, limit);
        }

        return filtered;
    }, [backendCampaigns, limit, onlyActive]);

    const isLoading = isBackendLoading;
    const isError = Boolean(backendError);
    const error = backendError || null;
    const refetch = async () => {
        await refetchBackend();
    };

    if (isLoading) {
        const skeletonCount = limit > 0 ? limit : 6;
        if (limit > 0) {
            return (
                <div className="home-featured-campaign-grid">
                    {Array.from({ length: skeletonCount }).map((_, idx) => (
                        <FeaturedCampaignCardSkeleton key={idx} />
                    ))}
                </div>
            );
        }
        return (
            <div className="flex flex-col gap-4">
                {Array.from({ length: skeletonCount }).map((_, idx) => (
                    <CampaignListRowSkeleton key={idx} />
                ))}
            </div>
        );
    }

    if (isError) {
        return (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-6">
                <p className="mb-3 text-sm font-semibold text-red-300">
                    Không thể tải chiến dịch
                </p>
                <p className="mb-4 text-xs text-red-200/90">{error}</p>
                <button
                    onClick={() => refetch()}
                    className="rounded-lg border border-red-400/50 bg-red-500/20 px-4 py-2 text-sm text-red-100 transition hover:bg-red-500/30"
                >
                    Thử lại
                </button>
            </div>
        );
    }

    if (campaigns.length === 0) {
        return (
            <div className="rounded-lg border border-[var(--accent-gold)]/30 bg-[rgba(245,158,11,0.08)] p-6 text-center">
                <p className="text-sm text-[var(--accent-gold)]">Chưa có chiến dịch</p>
            </div>
        );
    }

    return (
        <div className="space-y-5">
            {limit === 0 && (
                <div className="flex items-center justify-between">
                    <h3 className="font-display text-lg font-semibold text-[var(--text-primary)]">
                        Chiến dịch ({campaigns.length})
                    </h3>
                    <button
                        onClick={() => refetch()}
                        className="rounded-lg border border-[var(--border-glow)] bg-[rgba(99,102,241,0.1)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] transition hover:text-[var(--accent-cyan)]"
                    >
                        Tải lại
                    </button>
                </div>
            )}

            {limit > 0 ? (
                <div className="home-featured-campaign-grid">
                    {campaigns.map((campaign) => (
                        <FeaturedCampaignCard
                            key={campaign.id}
                            campaign={campaign}
                        />
                    ))}
                </div>
            ) : (
                <div className="flex flex-col gap-4">
                    {campaigns.map((campaign) => (
                        <CampaignListRow key={campaign.id} campaign={campaign} />
                    ))}
                </div>
            )}
        </div>
    );
}

/**
 * Contract Reading Example Component
 * Shows how to use contract reading hooks
 */
export function ContractReadingExample() {
    return (
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-6">
            <h3 className="font-semibold text-indigo-900 mb-4">
                📚 Ví dụ đọc dữ liệu contract
            </h3>
            <pre className="bg-white border border-indigo-200 rounded p-3 overflow-x-auto text-xs text-gray-700">
                {`// Import hooks
import {
  useContractStats,
  useReadAllCampaigns,
  useReadCampaign
} from '@/lib';

// Use in component
function MyComponent() {
  // Read statistics
  const stats = useContractStats();
  if (stats.isLoading) return <div>Loading...</div>;
  if (stats.isError) return <div>Error: {stats.errors}</div>;

  // Read specific campaign
  const campaign = useReadCampaign(0);

  return (
    <div>
      <p>Total: {stats.campaignCount}</p>
      <p>Raised: {stats.totalRaised} ETH</p>
    </div>
  );
}`}
            </pre>
        </div>
    );
}
