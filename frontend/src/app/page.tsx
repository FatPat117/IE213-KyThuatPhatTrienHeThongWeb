"use client";


import { ContractStatsDisplay } from "@/components/contract/ContractReadComponent";
import WalletStatus from "@/components/wallet/WalletStatus";
import {
    getPublicReviewerProfiles,
    getReviewerAggregates,
    getUserProfile,
} from "@/lib";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
    useCallback,
    useEffect,
    useMemo,
    useState,
    useSyncExternalStore
} from "react";
import { formatEther } from "viem";
import { useAccount, useChainId } from "wagmi";
const CampaignListDisplay = dynamic(() => import("@/components/contract/ContractReadComponent").then(m => m.CampaignListDisplay), { ssr: false });

const SEPOLIA_CHAIN_ID = 11155111;
const EMPTY_SUBSCRIBE = () => () => {};

type ReviewerCard = {
    id: string;
    name: string;
    role: string;
    organizationName: string;
    region: string;
    image: string;
    safeAddress: string;
    campaignCount: number;
    totalDisbursedEth: string;
};

function shortenAddress(address: string) {
    if (!address) return "";
    if (address.length <= 12) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function weiToEthText(wei: string) {
    try {
        const value = Number(formatEther(BigInt(wei || "0")));
        return value.toFixed(4);
    } catch {
        return "0.0000";
    }
}

function useIsHydrated() {
    return useSyncExternalStore(
        EMPTY_SUBSCRIBE,
        () => true,
        () => false,
    );
}

function IconShield() {
    return (
        <svg className="h-6 w-6 text-[var(--accent-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
        </svg>
    );
}

function IconBolt() {
    return (
        <svg className="h-6 w-6 text-[var(--accent-cyan)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
        </svg>
    );
}

function IconGlobe() {
    return (
        <svg className="h-6 w-6 text-[var(--accent-gold)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12h0" />
        </svg>
    );
}

export default function Home() {
    const isHydrated = useIsHydrated();
    const { isConnected } = useAccount();
    const chainId = useChainId();
    const isSepoliaNetwork = chainId === SEPOLIA_CHAIN_ID;
    const safeIsConnected = isHydrated && isConnected;
    const safeIsSepoliaNetwork = isHydrated && isSepoliaNetwork;
    const [reviewers, setReviewers] = useState<ReviewerCard[]>([]);
    const [isLoadingReviewers, setIsLoadingReviewers] = useState(true);
    const [reviewerError, setReviewerError] = useState<string | null>(null);
    const [isRefreshingReviewers, setIsRefreshingReviewers] = useState(false);
    const [reviewerUpdatedAt, setReviewerUpdatedAt] = useState<string | null>(
        null,
    );

    const buildCardsFromSafes = useCallback(
        async (safes: string[]): Promise<ReviewerCard[]> => {
            const normalized = Array.from(
                new Set(
                    safes
                        .map((item) => item.trim().toLowerCase())
                        .filter((item) => /^0x[a-f0-9]{40}$/.test(item)),
                ),
            );
            const cards = await Promise.all(
                normalized.map(async (safe) => {
                    let profile: Awaited<
                        ReturnType<typeof getUserProfile>
                    > | null = null;
                    try {
                        profile = await getUserProfile(safe);
                    } catch {
                        profile = null;
                    }
                    return {
                        id: safe,
                        name:
                            profile?.displayName?.trim() ||
                            shortenAddress(safe),
                        role: "Kiểm duyệt viên đa chữ ký",
                        organizationName: "Chưa rõ tổ chức",
                        region: "Chưa rõ vùng phụ trách",
                        image: profile?.avatarUrl?.trim() || "",
                        safeAddress: safe,
                        campaignCount: 0,
                        totalDisbursedEth: "0.0000",
                    };
                }),
            );
            return cards;
        },
        [],
    );

    const refreshReviewers = useCallback(async () => {
        try {
            setIsRefreshingReviewers(true);
            setReviewerError(null);

            const [aggregates, reviewerProfiles] = await Promise.all([
                getReviewerAggregates(),
                getPublicReviewerProfiles().catch(() => []),
            ]);

            const profileByWallet = new Map(
                reviewerProfiles.map((item) => [
                    (item.walletAddress || "").trim().toLowerCase(),
                    item,
                ]),
            );

            const reviewerCards = await Promise.all(
                aggregates.map(async (aggregate) => {
                    const safe = aggregate.reviewerSafe.trim().toLowerCase();
                    let userProfile: Awaited<
                        ReturnType<typeof getUserProfile>
                    > | null = null;
                    try {
                        userProfile = await getUserProfile(safe);
                    } catch {
                        userProfile = null;
                    }

                    const reviewerProfile = profileByWallet.get(safe);
                    const organizationName =
                        (reviewerProfile?.organizationName || "").trim() ||
                        "Chưa rõ tổ chức";
                    const region =
                        (reviewerProfile?.region || "").trim() ||
                        "Chưa rõ vùng phụ trách";

                    return {
                        id: safe,
                        name:
                            userProfile?.displayName?.trim() ||
                            shortenAddress(safe),
                        role: "Kiểm duyệt viên đa chữ ký",
                        organizationName,
                        region,
                        image: userProfile?.avatarUrl?.trim() || "",
                        safeAddress: safe,
                        campaignCount: aggregate.campaignCount,
                        totalDisbursedEth: weiToEthText(
                            aggregate.totalDisbursedWei,
                        ),
                    } as ReviewerCard;
                }),
            );

            setReviewers(reviewerCards);
            setReviewerUpdatedAt(new Date().toLocaleTimeString("vi-VN"));
        } catch {
            setReviewerError(
                "Chưa tải được danh sách reviewer. Vui lòng thử lại sau.",
            );
        } finally {
            setIsLoadingReviewers(false);
            setIsRefreshingReviewers(false);
        }
    }, []);

    useEffect(() => {
        refreshReviewers();
        const interval = setInterval(() => {
            refreshReviewers();
        }, 60_000);

        return () => clearInterval(interval);
    }, [refreshReviewers]);

    useEffect(() => {
        const nodes = document.querySelectorAll("[data-fade-in]");
        if (!nodes.length) return;

        const reveal = (node: Element) => {
            node.classList.add("is-visible");
        };

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        reveal(entry.target);
                        observer.unobserve(entry.target);
                    }
                });
            },
            { threshold: 0.08, rootMargin: "0px 0px 0px 0px" },
        );

        nodes.forEach((node) => {
            node.classList.add("fade-pending");
            const rect = node.getBoundingClientRect();
            const inView =
                rect.top < window.innerHeight * 0.92 &&
                rect.bottom > 0;
            if (inView) {
                reveal(node);
            } else {
                observer.observe(node);
            }
        });

        return () => observer.disconnect();
    }, [isLoadingReviewers, reviewers.length]);

    const reviewerCarousel = useMemo(() => {
        if (reviewers.length <= 1) return reviewers;
        return [...reviewers, ...reviewers];
    }, [reviewers]);

    return (
        <div className="page-shell">
            <main className="mx-auto flex w-full max-w-6xl flex-col gap-24 px-6 py-20 md:px-10 lg:gap-28">
                {/* Hero Section */}
                <section className="hero-mesh-wrap hero-particles relative grid gap-14 rounded-3xl bg-gradient-to-br from-[var(--bg-primary)] via-[#070d1a] to-[var(--bg-secondary)] p-6 md:p-10 lg:grid-cols-[1fr_1.05fr] lg:items-center">
                    <div className="hero-orb hero-orb-tl" aria-hidden />
                    <div className="hero-orb hero-orb-br" aria-hidden />
                    <div className="relative z-10 flex flex-col gap-8" data-fade-in>
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="badge-glass-cyan rounded-full px-3.5 py-1 text-xs font-semibold uppercase tracking-[0.15em]">
                                Vận hành bằng blockchain
                            </span>
                            {!safeIsConnected && (
                                <span className="rounded-full border border-[var(--accent-gold)]/40 bg-[rgba(245,158,11,0.1)] px-3.5 py-1 text-xs font-semibold text-[var(--accent-gold)]">
                                    Chế độ xem
                                </span>
                            )}
                            {safeIsConnected && !safeIsSepoliaNetwork && (
                                <span className="rounded-full border border-red-500/40 bg-red-500/10 px-3.5 py-1 text-xs font-semibold text-red-300">
                                    Sai mạng
                                </span>
                            )}
                            {safeIsConnected && safeIsSepoliaNetwork && (
                                <span className="badge-sepolia-glow rounded-full border border-[rgba(16,185,129,0.4)] bg-[rgba(16,185,129,0.12)] px-3.5 py-1 text-xs font-semibold text-[var(--accent-green)]">
                                    Đã kết nối Sepolia
                                </span>
                            )}
                        </div>

                        <div className="space-y-5">
                            <h1 className="font-display text-[2.75rem] font-extrabold leading-[1.1] tracking-tight text-gradient-hero sm:text-6xl lg:text-[3.5rem]">
                                Quyên góp minh bạch trên Ethereum
                            </h1>
                            <p className="max-w-xl text-lg leading-relaxed text-[var(--text-secondary)]">
                                Mỗi khoản quyên góp được ghi trên blockchain.
                                Không trung gian, đầy đủ minh bạch. Xem dữ liệu
                                mọi lúc — kể cả khi chưa kết nối ví.
                            </p>
                        </div>

                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                            <Link
                                href="/campaigns/create"
                                className="btn-gradient-hero inline-flex items-center justify-center gap-2 rounded-full px-6 py-3.5 text-base font-semibold text-white"
                            >
                                Bắt đầu chiến dịch
                            </Link>
                            <Link
                                href="/campaigns"
                                className="btn-glass-outline inline-flex items-center justify-center rounded-full px-6 py-3.5 text-base font-semibold"
                            >
                                Danh sách các chiến dịch
                            </Link>
                        </div>

                        <div className="flex gap-10 border-t border-[var(--border-glow)] pt-8">
                            <div>
                                <p className="text-sm font-medium text-[var(--text-secondary)]">
                                    Chiến dịch
                                </p>
                                <p className="font-mono-data mt-0.5 text-2xl font-bold text-[var(--accent-cyan)]" style={{ textShadow: "0 0 16px rgba(6,182,212,0.35)" }}>
                                    On-chain
                                </p>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-[var(--text-secondary)]">
                                    Cộng đồng
                                </p>
                                <p className="font-mono-data mt-0.5 text-2xl font-bold text-[var(--accent-primary)]" style={{ textShadow: "0 0 16px rgba(99,102,241,0.35)" }}>
                                    Mở
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="relative z-10 flex flex-col gap-5" data-fade-in>
                        <div className="glass-card rounded-2xl p-6">
                            <div className="mb-4 flex items-center gap-2">
                                <span className="pulse-dot-green h-2 w-2 rounded-full bg-[var(--accent-green)]" />
                                <span className="text-sm font-medium text-[var(--text-secondary)]">
                                    Dữ liệu on-chain trực tiếp
                                </span>
                            </div>
                            <ContractStatsDisplay />
                        </div>
                        <div className="glass-card rounded-2xl p-6">
                            <p className="mb-3 text-sm font-semibold text-[var(--text-primary)]">
                                Kết nối ví
                            </p>
                            <WalletStatus />
                        </div>
                    </div>
                </section>

                {/* Key Features Section */}
                <section className="flex flex-col gap-12 rounded-3xl bg-gradient-to-b from-[var(--bg-primary)] to-[var(--bg-secondary)] px-2 py-4 md:px-4">
                    <div className="text-center" data-fade-in>
                        <p className="mb-2 text-sm font-semibold uppercase tracking-[0.15em] text-gradient-hero">
                            Lợi ích
                        </p>
                        <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
                            Tại sao chọn quyên góp phi tập trung?
                        </h2>
                        <p className="mx-auto mt-3 max-w-xl text-lg text-[var(--text-secondary)]">
                            Minh bạch, an toàn và dễ tiếp cận trong mỗi giao
                            dịch.
                        </p>
                    </div>

                    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                        <div className="benefit-card rounded-2xl p-8" data-accent="indigo" data-fade-in>
                            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl border border-[rgba(99,102,241,0.25)] bg-[rgba(99,102,241,0.15)]">
                                <IconShield />
                            </div>
                            <h3 className="font-display text-lg font-bold">
                                Hoàn toàn minh bạch
                            </h3>
                            <p className="mt-2 leading-relaxed text-[var(--text-secondary)]">
                                Mọi giao dịch được ghi trên blockchain. Bạn luôn
                                biết từng khoản quyên góp đi đâu.
                            </p>
                        </div>
                        <div className="benefit-card rounded-2xl p-8" data-accent="cyan" data-fade-in>
                            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl border border-[rgba(6,182,212,0.25)] bg-[rgba(6,182,212,0.15)]">
                                <IconBolt />
                            </div>
                            <h3 className="font-display text-lg font-bold">
                                Cập nhật thời gian thực
                            </h3>
                            <p className="mt-2 leading-relaxed text-[var(--text-secondary)]">
                                Tiến trình chiến dịch cập nhật ngay từ
                                blockchain, không trễ, không trung gian.
                            </p>
                        </div>
                        <div className="benefit-card rounded-2xl p-8 sm:col-span-2 lg:col-span-1" data-accent="gold" data-fade-in>
                            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl border border-[rgba(245,158,11,0.25)] bg-[rgba(245,158,11,0.12)]">
                                <IconGlobe />
                            </div>
                            <h3 className="font-display text-lg font-bold">
                                Toàn cầu & dễ tiếp cận
                            </h3>
                            <p className="mt-2 leading-relaxed text-[var(--text-secondary)]">
                                Không giới hạn địa lý. Ai có ví đều có thể tham
                                gia tài trợ từ bất kỳ đâu.
                            </p>
                        </div>
                    </div>
                </section>

                {/* Reviewer Board Section */}
                <section className="glass-card-teal flex flex-col gap-10 rounded-2xl p-6 md:p-8" data-fade-in>
                    <div className="grid gap-5 md:grid-cols-2 md:items-end">
                        <div>
                            <p className="mb-2 text-sm font-semibold uppercase tracking-[0.15em] text-[var(--accent-cyan)]">
                                Kiểm duyệt
                            </p>
                            <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
                                Bảng danh sách kiểm duyệt viên
                            </h2>
                        </div>
                        <div className="flex flex-col items-start gap-2 md:items-end md:text-right">
                            <p className="rounded-full bg-[var(--gradient-hero)] px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white">
                                Hội đồng quản lý quỹ
                            </p>
                            <button
                                type="button"
                                onClick={refreshReviewers}
                                disabled={isRefreshingReviewers}
                                className="rounded-full border border-[rgba(6,182,212,0.4)] bg-[rgba(6,182,212,0.1)] px-3 py-1.5 text-xs font-semibold text-[var(--accent-cyan)] transition hover:bg-[rgba(6,182,212,0.2)] disabled:cursor-not-allowed disabled:opacity-70"
                            >
                                {isRefreshingReviewers
                                    ? "Đang làm mới..."
                                    : "Làm mới"}
                            </button>
                            {reviewerUpdatedAt && (
                                <p className="text-xs text-[var(--text-secondary)]">
                                    Cập nhật lúc {reviewerUpdatedAt}
                                </p>
                            )}
                            <div className="mt-2 h-1 w-44 rounded-full bg-[var(--gradient-hero)] md:ml-auto" />
                        </div>
                    </div>

                    {reviewerError && (
                        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
                            {reviewerError}
                        </div>
                    )}

                    {isLoadingReviewers && (
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {[1, 2, 3].map((idx) => (
                                <div
                                    key={idx}
                                    className="h-[360px] animate-pulse rounded-2xl border border-[rgba(6,182,212,0.2)] bg-[rgba(6,182,212,0.06)]"
                                />
                            ))}
                        </div>
                    )}

                    {!isLoadingReviewers && reviewers.length === 0 && (
                        <div className="rounded-xl border border-[var(--accent-gold)]/30 bg-[rgba(245,158,11,0.08)] px-4 py-5 text-sm text-[var(--accent-gold)]">
                            Hiện chưa có reviewer safe khả dụng để hiển thị. Vui
                            lòng thử làm mới sau.
                        </div>
                    )}

                    {!isLoadingReviewers && reviewers.length > 0 && (
                        <div className="relative overflow-hidden rounded-2xl border border-[rgba(6,182,212,0.15)] bg-[rgba(6,182,212,0.04)] py-2">
                            <div
                                className={`${reviewers.length > 1 ? "reviewer-marquee-track" : ""} flex w-max gap-6 px-4 md:px-6`}
                            >
                                {reviewerCarousel.map((reviewer, index) => (
                                    <article
                                        key={`${reviewer.safeAddress}-${index}`}
                                        className="reviewer-card-luxury group relative w-[280px] flex-shrink-0 overflow-hidden rounded-2xl transition duration-300 hover:-translate-y-1 hover:shadow-[0_12px_40px_rgba(6,182,212,0.15)]"
                                    >
                                        <div className="flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-t-2xl bg-[rgba(6,182,212,0.06)]">
                                            {reviewer.image ? (
                                                <div className="reviewer-avatar-ring h-16 w-16 shrink-0 overflow-hidden rounded-full">
                                                    <img
                                                        src={reviewer.image}
                                                        alt={reviewer.name}
                                                        className="h-16 w-16 object-cover object-top"
                                                        loading="lazy"
                                                    />
                                                </div>
                                            ) : (
                                                <div className="reviewer-avatar-ring flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[rgba(6,182,212,0.12)]">
                                                    <span className="font-mono-data text-[32px] font-bold leading-none text-[var(--accent-cyan)]">
                                                        {reviewer.safeAddress
                                                            .replace(/^0x/i, "")
                                                            .slice(0, 2)
                                                            .toUpperCase() || "—"}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="space-y-2.5 p-5 text-center">
                                            <h3 className="font-display text-xl font-bold uppercase tracking-tight">
                                                {reviewer.name}
                                            </h3>
                                            <div className="mx-auto h-0.5 w-14 rounded-full bg-[var(--gradient-hero)]" />
                                            <p className="inline-block rounded-full border border-[rgba(6,182,212,0.35)] bg-[rgba(6,182,212,0.12)] px-2.5 py-0.5 text-xs font-semibold text-[var(--accent-cyan)]">
                                                {reviewer.role}
                                            </p>
                                            <p className="line-clamp-2 text-sm font-semibold text-[var(--text-primary)]">
                                                {reviewer.organizationName}
                                            </p>
                                            <p className="line-clamp-2 text-sm leading-relaxed text-[var(--text-secondary)]">
                                                Vùng phụ trách: {reviewer.region}
                                            </p>
                                            <p className="font-mono-data pt-1 text-xs text-[var(--accent-cyan)]">
                                                {reviewer.campaignCount} chiến dịch
                                                · {reviewer.totalDisbursedEth} ETH
                                                đã giải ngân
                                            </p>
                                        </div>

                                        <div className="pointer-events-none absolute inset-3 z-20 translate-y-3 rounded-2xl border border-[rgba(6,182,212,0.35)] bg-[var(--bg-card)]/95 p-4 text-left opacity-0 shadow-xl backdrop-blur-sm transition duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                                            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--accent-cyan)]">
                                                Hồ sơ kiểm duyệt
                                            </p>
                                            <h4 className="mt-1 text-sm font-bold">
                                                {reviewer.organizationName}
                                            </h4>
                                            <p className="mt-1 text-xs text-[var(--text-secondary)]">
                                                {reviewer.region}
                                            </p>
                                            <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                                                <div className="rounded-lg bg-[rgba(6,182,212,0.08)] p-2.5">
                                                    <p className="font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                                                        Chiến dịch
                                                    </p>
                                                    <p className="font-mono-data mt-1 text-sm font-bold text-[var(--accent-cyan)]">
                                                        {reviewer.campaignCount}
                                                    </p>
                                                </div>
                                                <div className="rounded-lg bg-[rgba(6,182,212,0.08)] p-2.5">
                                                    <p className="font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                                                        Đã giải ngân
                                                    </p>
                                                    <p className="font-mono-data mt-1 text-sm font-bold text-[var(--accent-cyan)]">
                                                        {
                                                            reviewer.totalDisbursedEth
                                                        }{" "}
                                                        ETH
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </article>
                                ))}
                            </div>
                            <div className="reviewer-marquee-fade-l pointer-events-none absolute inset-y-0 left-0 w-14" />
                            <div className="reviewer-marquee-fade-r pointer-events-none absolute inset-y-0 right-0 w-14" />
                        </div>
                    )}
                </section>

                <style jsx>{`
                    .reviewer-marquee-track {
                        animation: reviewer-scroll 20s linear infinite;
                        will-change: transform;
                    }

                    .reviewer-marquee-track:hover {
                        animation-play-state: paused;
                    }

                    @keyframes reviewer-scroll {
                        from {
                            transform: translateX(0);
                        }
                        to {
                            transform: translateX(-50%);
                        }
                    }
                `}</style>

                {/* Featured Campaigns Section */}
                <section className="glass-card flex flex-col gap-8 rounded-2xl p-6 md:p-8" data-fade-in>
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                            <p className="mb-1 text-sm font-semibold uppercase tracking-[0.15em] text-gradient-hero">
                                Khám phá
                            </p>
                            <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
                                Chiến dịch nổi bật
                            </h2>
                            <p className="mt-2 text-[var(--text-secondary)]">
                                Các chiến dịch đang hoạt động, tạo tác động thực
                                trên blockchain
                            </p>
                        </div>
                        <Link
                            href="/campaigns"
                            className="inline-flex w-fit items-center justify-center gap-1.5 text-sm font-semibold text-[var(--accent-cyan)] transition hover:underline hover:decoration-[var(--accent-cyan)] hover:underline-offset-4 hover:[text-shadow:0_0_12px_rgba(6,182,212,0.5)]"
                        >
                            Xem tất cả
                            <span aria-hidden>→</span>
                        </Link>
                    </div>
                    <div>
                        <CampaignListDisplay limit={6} onlyActive={true} />
                    </div>
                </section>

                {/* How It Works Section */}
                <section id="about" className="flex flex-col gap-12 rounded-3xl bg-[#03060f] px-4 py-12 md:px-8">
                    <div className="text-center" data-fade-in>
                        <p className="mb-2 text-sm font-semibold uppercase tracking-[0.15em] text-gradient-hero">
                            Quy trình
                        </p>
                        <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
                            Hoạt động như thế nào
                        </h2>
                        <p className="mx-auto mt-3 max-w-xl text-lg text-[var(--text-secondary)]">
                            4 bước đơn giản để khởi chạy hoặc hỗ trợ chiến dịch
                        </p>
                    </div>

                    <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
                        {[
                            {
                                step: 1,
                                title: "Kết nối ví",
                                desc: "Liên kết MetaMask hoặc ví ưa thích trên mạng Sepolia.",
                            },
                            {
                                step: 2,
                                title: "Tạo chiến dịch",
                                desc: "Đặt mục tiêu, thời hạn và mô tả chiến dịch trên chuỗi khối.",
                            },
                            {
                                step: 3,
                                title: "Chia sẻ & quyên góp",
                                desc: "Quảng bá và theo dõi quyên góp theo thời gian thực.",
                            },
                            {
                                step: 4,
                                title: "Giải ngân an toàn",
                                desc: "Tiền được giải ngân vào ví escrow, đảm bảo sử dụng đúng mục đích.",
                            },
                        ].map(({ step, title, desc }) => (
                            <div key={step} className="flex flex-col" data-fade-in>
                                <div className="step-badge flex h-11 w-11 items-center justify-center rounded-xl font-display text-base font-bold text-white">
                                    {step}
                                </div>
                                <h3 className="mt-4 font-display text-lg font-bold">
                                    {title}
                                </h3>
                                <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
                                    {desc}
                                </p>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Final CTA Section */}
                <section className="relative overflow-hidden rounded-2xl px-8 py-14 text-center md:px-12" data-fade-in style={{ background: "var(--gradient-hero)" }}>
                    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.12),transparent_50%)]" />
                    <h2 className="relative font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
                        Sẵn sàng tạo ra sự thay đổi?
                    </h2>
                    <p className="relative mx-auto mt-4 max-w-xl text-lg text-white/85">
                        Bắt đầu chiến dịch, hỗ trợ mục đích, hoặc theo dõi đóng
                        góp trên blockchain. Tham gia cộng đồng ngay.
                    </p>
                    <div className="relative mt-8 flex flex-col gap-4 sm:flex-row sm:justify-center">
                        {safeIsConnected && safeIsSepoliaNetwork ? (
                            <Link
                                href="/campaigns/create"
                                className="inline-flex items-center justify-center rounded-full bg-white px-8 py-3.5 text-base font-bold text-[var(--accent-primary)] shadow-lg transition hover:scale-[1.02] hover:shadow-[0_0_24px_rgba(255,255,255,0.4)]"
                            >
                                Bắt đầu chiến dịch
                            </Link>
                        ) : (
                            <button
                                className="inline-flex cursor-not-allowed items-center justify-center rounded-full bg-white/20 px-8 py-3.5 text-base font-bold text-white"
                                disabled
                                title={
                                    "Kết nối ví để tạo chiến dịch"
                                }
                            >
                                Bắt đầu chiến dịch
                            </button>
                        )}
                        <Link
                            href="/campaigns"
                            className="inline-flex items-center justify-center rounded-full border-2 border-white/80 px-8 py-3.5 text-base font-bold text-white transition hover:bg-white/10"
                        >
                            Danh sách các chiến dịch
                        </Link>
                    </div>
                </section>

                {/* Footer */}
                <footer className="border-t border-[var(--border-glow)] pb-10 pt-14" data-fade-in>
                    <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="flex flex-col gap-3">
                            <p className="font-display text-lg font-bold text-gradient-hero">
                                FundRaising
                            </p>
                            <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
                                Nền tảng quyên góp phi tập trung trên
                                blockchain.
                            </p>
                        </div>
                        <div className="flex flex-col gap-3">
                            <p className="text-sm font-semibold text-[var(--text-primary)]">
                                Nền tảng
                            </p>
                            <Link
                                href="/campaigns"
                                className="text-sm text-[var(--text-secondary)] transition hover:text-[var(--accent-cyan)]"
                            >
                                Danh sách các chiến dịch
                            </Link>
                            <Link
                                href="/leaderboard"
                                className="text-sm text-[var(--text-secondary)] transition hover:text-[var(--accent-cyan)]"
                            >
                                Bảng xếp hạng
                            </Link>
                            <Link
                                href="/campaigns/create"
                                className="text-sm text-[var(--text-secondary)] transition hover:text-[var(--accent-cyan)]"
                            >
                                Tạo chiến dịch
                            </Link>
                            <Link
                                href="/status"
                                className="text-sm text-[var(--text-secondary)] transition hover:text-[var(--accent-cyan)]"
                            >
                                Trạng thái hệ thống
                            </Link>
                        </div>
                        <div className="flex flex-col gap-3">
                            <p className="text-sm font-semibold text-[var(--text-primary)]">
                                Mạng
                            </p>
                            <a
                                href="https://sepolia.etherscan.io"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-mono-data text-sm text-[var(--text-secondary)] transition hover:text-[var(--accent-cyan)]"
                            >
                                Etherscan Sepolia
                            </a>
                            <a
                                href="https://faucet.sepolia.dev"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-mono-data text-sm text-[var(--text-secondary)] transition hover:text-[var(--accent-cyan)]"
                            >
                                Faucet Sepolia
                            </a>
                        </div>
                        <div className="flex flex-col gap-3">
                            <p className="text-sm font-semibold text-[var(--text-primary)]">
                                Về chúng tôi
                            </p>
                            <p className="text-sm text-[var(--text-secondary)]">
                                Dự án IE213 — Kỹ thuật phát triển hệ thống web
                            </p>
                        </div>
                    </div>
                    <div className="mt-12 border-t border-[var(--border-glow)] pt-8">
                        <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
                            <p className="text-center text-sm text-[var(--text-secondary)]">
                                © 2024 FundRaising. Bảo lưu mọi quyền.
                            </p>
                        </div>
                    </div>
                </footer>
            </main>
        </div>
    );
}


