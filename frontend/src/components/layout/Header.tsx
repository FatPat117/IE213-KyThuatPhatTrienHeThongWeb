"use client";

import NotificationBell from "@/components/layout/NotificationBell";
import { useAuth, useIsReviewer, useReadContractOwner } from "@/lib";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
const WalletConnectButton = dynamic(
    () => import("@/components/wallet/WalletConnectButton"),
    { ssr: false },
);

function isLinkActive(href: string, pathname: string): boolean {
    if (href === "/campaigns") {
        return (
            pathname === "/campaigns" ||
            (pathname.startsWith("/campaigns/") &&
                !pathname.startsWith("/campaigns/create"))
        );
    }
    if (href === "/campaigns/create") {
        return pathname.startsWith("/campaigns/create");
    }
    return pathname === href || pathname.startsWith(href + "/");
}

type NavLink = { href: string; label: string };

function NavLinkItem({
    link,
    pathname,
    variant,
    onNavigate,
}: {
    link: NavLink;
    pathname: string;
    variant: "desktop" | "mobile";
    onNavigate?: () => void;
}) {
    const active = isLinkActive(link.href, pathname);

    if (variant === "desktop") {
        return (
            <div className="relative group">
                <Link
                    href={link.href}
                    className={`relative px-3 py-2 text-sm font-medium transition-colors after:absolute after:bottom-0 after:left-0 after:h-0.5 after:transition-all after:duration-300 ${
                        active
                            ? "nav-link-active after:w-full"
                            : "nav-link-idle after:w-0 hover:after:w-full"
                    }`}
                >
                    {link.label}
                </Link>
            </div>
        );
    }

    return (
        <Link
            href={link.href}
            onClick={onNavigate}
            className={`block rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                active
                    ? "bg-[rgba(99,102,241,0.2)] text-[var(--accent-cyan)]"
                    : "text-[var(--text-secondary)] hover:bg-[rgba(99,102,241,0.1)] hover:text-[var(--text-primary)]"
            }`}
        >
            {link.label}
        </Link>
    );
}

export default function Header() {
    const pathname = usePathname();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isMounted, setIsMounted] = useState(false);
    const { token, user } = useAuth();
    const { isAdminOnChain } = useReadContractOwner();
    const { isReviewer } = useIsReviewer();

    const closeMobileMenu = useCallback(() => {
        setIsMobileMenuOpen(false);
    }, []);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setIsMounted(true);
    }, []);

    useEffect(() => {
        // Đóng sidebar khi chuyển route (browser back / link)
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setIsMobileMenuOpen(false);
    }, [pathname]);

    useEffect(() => {
        if (!isMobileMenuOpen) return;

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") closeMobileMenu();
        };
        window.addEventListener("keydown", onKeyDown);

        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener("keydown", onKeyDown);
        };
    }, [isMobileMenuOpen, closeMobileMenu]);

    const hasProvider = !isMounted
        ? true
        : Boolean((window as Window & { ethereum?: unknown }).ethereum);
    const isSignedIn = isMounted ? Boolean(token && user?.wallet) : false;
    const walletAddress = (user?.wallet || "").trim().toLowerCase();

    const isAdmin = Boolean(walletAddress) && isAdminOnChain;

    const publicLinks: NavLink[] = [
        { href: "/", label: "Trang chủ" },
        { href: "/campaigns", label: "Chiến dịch" },
    ];
    const roleLinks: NavLink[] = [];

    if (isMounted) {
        if (isSignedIn && !isAdmin) {
            roleLinks.push({
                href: "/my-campaigns",
                label: "Các chiến dịch của tôi",
            });
        }
        if (isReviewer && !isAdmin) {
            roleLinks.push({ href: "/reviewer", label: "Các mốc đang chờ duyệt" });
        }
        if (isAdmin) {
            roleLinks.push({
                href: "/admin/campaigns",
                label: "Duyệt các chiến dịch mới",
            });
            roleLinks.push({
                href: "/admin/reviewers",
                label: "Quản lý danh sách kiểm duyệt viên",
            });
        }
    }

    const navLinks = [...publicLinks, ...roleLinks];

    const accountLinks: NavLink[] = [
        { href: "/settings", label: "Hồ sơ & cài đặt" },
    ];
    const visibleAccountLinks = accountLinks;

    const currentPath = pathname ?? "";

    return (
        <>
            <div
                className={`lg:hidden fixed inset-0 z-[100] bg-black/60 backdrop-blur-[2px] transition-opacity duration-300 ${
                    isMobileMenuOpen
                        ? "opacity-100 pointer-events-auto"
                        : "opacity-0 pointer-events-none"
                }`}
                aria-hidden={isMobileMenuOpen ? "false" : "true"}
            >
                <button
                    type="button"
                    className="absolute inset-0 w-full h-full cursor-default"
                    aria-label="Đóng menu"
                    tabIndex={isMobileMenuOpen ? 0 : -1}
                    onClick={closeMobileMenu}
                />
            </div>

            <aside
                id="mobile-nav-menu"
                role="dialog"
                aria-modal={isMobileMenuOpen ? "true" : "false"}
                aria-label="Menu điều hướng"
                aria-hidden={isMobileMenuOpen ? "false" : "true"}
                inert={!isMobileMenuOpen ? true : undefined}
                className={`lg:hidden fixed top-0 left-0 z-[101] flex h-dvh w-[min(85vw,20rem)] flex-col border-r border-[rgba(99,102,241,0.2)] bg-[var(--bg-secondary)] shadow-2xl transition-transform duration-300 ease-out ${
                    isMobileMenuOpen
                        ? "translate-x-0 pointer-events-auto"
                        : "-translate-x-full pointer-events-none"
                }`}
            >
                <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[rgba(99,102,241,0.2)] px-4 py-4">
                    <Link
                        href="/"
                        onClick={closeMobileMenu}
                        className="flex min-w-0 items-center gap-2.5"
                    >
                        <div className="logo-fd-gradient flex h-10 w-10 shrink-0 items-center justify-center font-display text-base font-bold text-white">
                            FD
                        </div>
                        <div className="flex min-w-0 flex-col">
                            <p className="truncate text-[10px] font-semibold uppercase leading-none tracking-widest text-[var(--accent-cyan)]">
                                FundRaising
                            </p>
                            <span className="truncate font-display text-base font-bold text-gradient-hero">
                                dApp
                            </span>
                        </div>
                    </Link>
                    <button
                        type="button"
                        onClick={closeMobileMenu}
                        className="inline-flex shrink-0 items-center justify-center rounded-lg p-2 text-[var(--text-secondary)] transition-colors hover:bg-[rgba(99,102,241,0.15)] hover:text-[var(--text-primary)]"
                        aria-label="Đóng menu"
                    >
                        <svg
                            className="w-6 h-6"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            aria-hidden
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M6 18L18 6M6 6l12 12"
                            />
                        </svg>
                    </button>
                </div>

                <nav
                    className="flex-1 overflow-y-auto px-4 py-4 space-y-1"
                    aria-label="Liên kết menu"
                >
                    {navLinks.map((link) => (
                        <NavLinkItem
                            key={link.href}
                            link={link}
                            pathname={currentPath}
                            variant="mobile"
                            onNavigate={closeMobileMenu}
                        />
                    ))}

                    {isSignedIn && (
                        <>
                            <p className="pb-1 pt-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                                Tài khoản
                            </p>
                            {visibleAccountLinks.map((link) => (
                                <NavLinkItem
                                    key={link.href}
                                    link={link}
                                    pathname={currentPath}
                                    variant="mobile"
                                    onNavigate={closeMobileMenu}
                                />
                            ))}
                        </>
                    )}
                </nav>

                <div className="shrink-0 border-t border-[rgba(99,102,241,0.2)] px-4 py-4">
                    <div className="mobile-wallet [&_button]:w-full [&_button]:text-sm [&_button]:py-2.5">
                        <WalletConnectButton />
                    </div>
                </div>
            </aside>

            <header className="nav-luxury sticky top-0 overflow-visible shadow-sm">
                {!hasProvider && (
                    <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 sm:px-6 lg:px-8">
                        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 py-2 sm:py-2.5">
                            <div className="flex min-w-0 flex-1 items-center gap-2">
                                <span className="shrink-0 text-base sm:text-lg">
                                    ⚠️
                                </span>
                                <p className="truncate text-xs font-medium text-amber-200 sm:text-sm">
                                    Chưa có MetaMask.{" "}
                                    <span className="hidden sm:inline">
                                        Cài đặt để kết nối ví.
                                    </span>
                                </p>
                            </div>
                            <a
                                href="https://metamask.io/download/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="shrink-0 whitespace-nowrap rounded-lg border border-amber-500/50 bg-amber-600/80 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-600 sm:px-4 sm:text-sm"
                            >
                                Cài đặt
                            </a>
                        </div>
                    </div>
                )}

                <nav
                    className="mx-auto flex w-full max-w-7xl items-center justify-between gap-2 px-4 sm:px-6 lg:px-8 py-3 sm:py-4"
                    aria-label="Điều hướng chính"
                >
                    <Link
                        href="/"
                        className="flex items-center gap-2 sm:gap-3 group cursor-pointer shrink-0 min-w-0"
                    >
                        <div className="logo-fd-gradient flex h-10 w-10 items-center justify-center font-display text-base font-bold text-white transition-all duration-300 group-hover:scale-105 sm:h-12 sm:w-12 sm:text-lg">
                            FD
                        </div>
                        <div className="hidden min-w-0 flex-col sm:flex">
                            <p className="text-xs font-semibold uppercase leading-none tracking-widest text-[var(--accent-cyan)]">
                                FundRaising
                            </p>
                            <span className="font-display text-xl font-bold text-gradient-hero">
                                dApp
                            </span>
                        </div>
                    </Link>

                    <div className="hidden lg:flex items-center gap-2 flex-1 justify-center px-4">
                        {navLinks.map((link) => (
                            <NavLinkItem
                                key={link.href}
                                link={link}
                                pathname={currentPath}
                                variant="desktop"
                            />
                        ))}
                    </div>

                    <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
                        {isSignedIn && (
                            <NotificationBell token={token} />
                        )}

                        <div className="relative hidden lg:block group">
                            <WalletConnectButton />
                            {isSignedIn && (
                                <div className="pointer-events-none invisible absolute right-0 top-full z-40 w-56 rounded-xl border border-[var(--border-glow)] bg-[var(--bg-card)] p-2 text-sm text-[var(--text-secondary)] opacity-0 shadow-lg shadow-black/40 transition before:pointer-events-none before:absolute before:-top-2 before:left-0 before:h-2 before:w-full before:content-[''] group-hover:pointer-events-auto group-hover:visible group-hover:opacity-100">
                                    {visibleAccountLinks.map((link) => {
                                        const active = isLinkActive(
                                            link.href,
                                            currentPath,
                                        );
                                        return (
                                            <Link
                                                key={link.href}
                                                href={link.href}
                                                className={`block rounded-lg px-3 py-2 text-xs font-medium ${
                                                    active
                                                        ? "bg-[rgba(99,102,241,0.2)] text-[var(--accent-cyan)]"
                                                        : "hover:bg-[rgba(99,102,241,0.1)] hover:text-[var(--text-primary)]"
                                                }`}
                                            >
                                                {link.label}
                                            </Link>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        <button
                            type="button"
                            onClick={() =>
                                setIsMobileMenuOpen((open) => !open)
                            }
                            className="inline-flex items-center justify-center rounded-lg p-2 text-[var(--text-secondary)] transition-colors hover:bg-[rgba(99,102,241,0.15)] hover:text-[var(--text-primary)] lg:hidden"
                            aria-label={
                                isMobileMenuOpen
                                    ? "Đóng menu"
                                    : "Mở menu"
                            }
                            aria-expanded={isMobileMenuOpen ? "true" : "false"}
                            aria-controls="mobile-nav-menu"
                        >
                            <svg
                                className="w-6 h-6"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                                aria-hidden
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d={
                                        isMobileMenuOpen
                                            ? "M6 18L18 6M6 6l12 12"
                                            : "M4 6h16M4 12h16M4 18h16"
                                    }
                                />
                            </svg>
                        </button>
                    </div>
                </nav>
            </header>
        </>
    );
}
