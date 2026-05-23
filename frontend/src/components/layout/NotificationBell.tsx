"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getPublicCampaignMilestones } from "@/lib/api/campaigns";
import {
    getMyNotifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    openNotificationStream,
    type NotificationItem,
} from "@/lib/api/notifications";
import { showNotificationToast } from "@/lib/ui/toast";

export default function NotificationBell({ token }: { token: string | null }) {
    const [open, setOpen] = useState(false);
    const [items, setItems] = useState<NotificationItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [realtimeConnected, setRealtimeConnected] = useState(false);
    const realtimeConnectedRef = useRef(false);
    const loadNotificationsRef = useRef<(() => void) | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const bellButtonRef = useRef<HTMLButtonElement | null>(null);
    const [panelPosition, setPanelPosition] = useState<{ top: number; right: number } | null>(
        null,
    );
    const [portalReady, setPortalReady] = useState(false);
    const toastedRef = useRef<Set<string>>(new Set());
    const initialLoadDone = useRef(false);
    const router = useRouter();

    const setRealtimeStatus = (connected: boolean) => {
        realtimeConnectedRef.current = connected;
        setRealtimeConnected(connected);
    };

    const triggerFallbackPoll = () => {
        realtimeConnectedRef.current = false;
        setRealtimeConnected(false);
        loadNotificationsRef.current?.();
    };

    const mergeNotification = (
        prev: NotificationItem[],
        incoming: NotificationItem,
    ): NotificationItem[] => {
        const normalized = {
            ...incoming,
            createdAt: incoming.createdAt || new Date().toISOString(),
        };
        const existed = prev.some((item) => item._id === normalized._id);
        const merged = existed
            ? prev.map((item) =>
                  item._id === normalized._id ? { ...item, ...normalized } : item,
              )
            : [normalized, ...prev];
        return merged
            .sort(
                (a, b) =>
                    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
            )
            .slice(0, 20);
    };

    useEffect(() => {
        if (!token) return;
        let cancelled = false;
        const load = async () => {
            try {
                setIsLoading(true);
                const data = await getMyNotifications(token, 20);
                if (!cancelled) {
                    setItems(data);
                    data.forEach((item) => toastedRef.current.add(item._id));
                    initialLoadDone.current = true;
                }
            } catch {
                if (!cancelled) setItems([]);
            } finally {
                if (!cancelled) {
                    setIsLoading(false);
                    initialLoadDone.current = true;
                }
            }
        };

        loadNotificationsRef.current = () => {
            if (!cancelled) void load();
        };

        load();

        const pollTimer = window.setInterval(() => {
            if (!realtimeConnectedRef.current) load();
        }, 10_000);

        const onVisible = () => {
            if (
                document.visibilityState === "visible" &&
                !realtimeConnectedRef.current
            ) {
                load();
            }
        };
        document.addEventListener("visibilitychange", onVisible);
        return () => {
            cancelled = true;
            loadNotificationsRef.current = null;
            window.clearInterval(pollTimer);
            document.removeEventListener("visibilitychange", onVisible);
        };
    }, [token]);

    useEffect(() => {
        if (!token) return;
        const controller = new AbortController();
        let active = true;
        let reconnectTimer: number | null = null;

        const connect = async () => {
            try {
                setRealtimeStatus(false);
                await openNotificationStream(
                    token,
                    (incoming) => {
                        if (!active) return;

                        // Deduplicate toasts using a ref to avoid issues with React StrictMode 
                        // or simultaneous stream/poll updates.
                        if (toastedRef.current.has(incoming._id)) {
                            return;
                        }
                        toastedRef.current.add(incoming._id);

                        // Only show toast if initial load is complete to avoid "burst" on refresh
                        if (initialLoadDone.current) {
                            showNotificationToast(
                                incoming.title,
                                incoming.message,
                                incoming._id,
                            );
                        }

                        setItems((prev) => mergeNotification(prev, incoming));
                    },
                    () => {
                        if (active) setRealtimeStatus(true);
                    },
                    controller.signal,
                );
                if (active && !controller.signal.aborted) {
                    triggerFallbackPoll();
                    reconnectTimer = window.setTimeout(connect, 1500);
                }
            } catch {
                if (active) triggerFallbackPoll();
                if (active && !controller.signal.aborted) {
                    reconnectTimer = window.setTimeout(connect, 3000);
                }
            }
        };

        connect();

        return () => {
            active = false;
            controller.abort();
            if (reconnectTimer) window.clearTimeout(reconnectTimer);
            realtimeConnectedRef.current = false;
            setRealtimeConnected(false);
        };
    }, [token]);

    const unreadCount = useMemo(
        () => items.filter((item) => !item.read).length,
        [items],
    );
    const formatTime = (value: string) => {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return "";
        return date.toLocaleString("vi-VN", {
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    const resolveMilestoneApprovedHref = async (campaignOnChainId: number) => {
        const fallback = `/campaigns/${campaignOnChainId}/milestones`;
        try {
            const { milestones } = await getPublicCampaignMilestones(
                campaignOnChainId,
            );
            let latestApproved: {
                milestoneId: number;
                approvedAt: string | null;
            } | null = null;
            for (const milestone of milestones) {
                if (!milestone.approvedAt) continue;
                if (!latestApproved) {
                    latestApproved = milestone;
                    continue;
                }
                const latestTime = new Date(
                    latestApproved.approvedAt || 0,
                ).getTime();
                const currentTime = new Date(
                    milestone.approvedAt || 0,
                ).getTime();
                if (currentTime > latestTime) {
                    latestApproved = milestone;
                }
            }

            if (!latestApproved) return fallback;
            return `/campaigns/${campaignOnChainId}/milestones/upload?milestone=${latestApproved.milestoneId}`;
        } catch {
            return fallback;
        }
    };

    useEffect(() => {
        setPortalReady(true);
    }, []);

    useEffect(() => {
        if (!open) {
            setPanelPosition(null);
            return;
        }

        const updatePosition = () => {
            const button = bellButtonRef.current;
            if (!button) return;
            const rect = button.getBoundingClientRect();
            setPanelPosition({
                top: rect.bottom + 8,
                right: Math.max(8, window.innerWidth - rect.right),
            });
        };

        updatePosition();
        window.addEventListener("resize", updatePosition);
        window.addEventListener("scroll", updatePosition, true);
        return () => {
            window.removeEventListener("resize", updatePosition);
            window.removeEventListener("scroll", updatePosition, true);
        };
    }, [open]);

    useEffect(() => {
        const onClickAway = (event: MouseEvent) => {
            const target = event.target as Node;
            if (containerRef.current?.contains(target)) return;
            if (
                target instanceof Element &&
                target.closest("[data-notification-panel]")
            ) {
                return;
            }
            setOpen(false);
        };
        window.addEventListener("mousedown", onClickAway);
        return () => window.removeEventListener("mousedown", onClickAway);
    }, []);

    if (!token) return null;

    const panelContent =
        open && panelPosition ? (
            <>
                <button
                    type="button"
                    aria-label="Đóng thông báo"
                    className="fixed inset-0 z-[9997] cursor-default bg-black/25"
                    onClick={() => setOpen(false)}
                />
                <div
                    data-notification-panel
                    className="fixed z-[9998] w-80 max-w-[calc(100vw-1rem)] rounded-xl border border-[rgba(99,102,241,0.35)] bg-[var(--bg-secondary)] p-3 shadow-2xl shadow-black/60"
                    style={{
                        top: panelPosition.top,
                        right: panelPosition.right,
                    }}
                >
                    <div className="mb-2 flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-[var(--text-primary)]">
                            Thông báo mới
                        </p>
                        <div className="flex items-center gap-2">
                            <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                    realtimeConnected
                                        ? "bg-[rgba(16,185,129,0.2)] text-[var(--accent-green)]"
                                        : "bg-[rgba(245,158,11,0.2)] text-[var(--accent-gold)]"
                                }`}
                            >
                                {realtimeConnected ? "Realtime" : "Đang kết nối"}
                            </span>
                            <button
                                type="button"
                                className="text-xs font-medium text-[var(--accent-cyan)] hover:text-[var(--accent-primary)]"
                                onClick={async () => {
                                    if (!token) return;
                                    await markAllNotificationsAsRead(token);
                                    setItems((prev) =>
                                        prev.map((item) => ({
                                            ...item,
                                            read: true,
                                        })),
                                    );
                                }}
                            >
                                Đánh dấu đã đọc
                            </button>
                        </div>
                    </div>
                    <div className="max-h-80 space-y-2 overflow-y-auto overscroll-contain">
                        {isLoading && (
                            <p className="text-xs text-[var(--text-secondary)]">
                                Đang tải thông báo...
                            </p>
                        )}
                        {items.length === 0 ? (
                            <p className="text-xs text-[var(--text-secondary)]">
                                Chưa có thông báo.
                            </p>
                        ) : (
                            items.map((item) => (
                                <div
                                    key={item._id}
                                    className={`relative rounded-lg border px-3 py-2 text-xs ${
                                        item.read
                                            ? "border-[rgba(99,102,241,0.25)] bg-[#11162a]"
                                            : "border-[rgba(6,182,212,0.45)] bg-[#0f1a2e]"
                                    }`}
                                >
                                    <p className="font-semibold text-[var(--text-primary)]">
                                        {item.title}
                                    </p>
                                    <p className="mt-1 text-[var(--text-secondary)]">
                                        {item.message}
                                    </p>
                                    <p className="mt-1 text-[10px] text-[var(--text-secondary)]">
                                        {formatTime(item.createdAt)}
                                    </p>
                                    {(() => {
                                        const reviewerTypes = new Set([
                                            "milestone_report_submitted",
                                            "milestone_disbursed",
                                            "campaign_assigned",
                                        ]);
                                        const adminTypes = new Set([
                                            "campaign_created",
                                            "campaign_pending_approval",
                                        ]);
                                        const isMilestoneApproved =
                                            item.type === "milestone_approved";
                                        const campaignId = item.campaignOnChainId;
                                        const hasCampaignId =
                                            typeof campaignId === "number";

                                        let href: string | null = null;
                                        let linkLabel = "Xem chi tiết";

                                        if (isMilestoneApproved && hasCampaignId) {
                                            href = `/campaigns/${campaignId}/milestones`;
                                            linkLabel = "Xem chi tiết mốc";
                                        } else if (reviewerTypes.has(item.type || "")) {
                                            href = "/reviewer";
                                            linkLabel = "Vào trang duyệt mốc";
                                        } else if (adminTypes.has(item.type || "")) {
                                            href = "/admin/campaigns";
                                            linkLabel = "Duyệt các chiến dịch mới";
                                        } else if (hasCampaignId) {
                                            href = `/campaigns/${campaignId}`;
                                            linkLabel = "Mở chiến dịch";
                                        }

                                        if (!href) return null;

                                        return (
                                            <Link
                                                href={href}
                                                className="relative z-10 mt-2 inline-block text-[11px] font-semibold text-[var(--accent-cyan)] underline-offset-2 hover:text-[var(--accent-primary)] hover:underline"
                                                onClick={async (event) => {
                                                    const shouldResolveMilestone =
                                                        isMilestoneApproved && hasCampaignId;
                                                    if (shouldResolveMilestone) {
                                                        event.preventDefault();
                                                    }
                                                    if (!item.read) {
                                                        try {
                                                            await markNotificationAsRead(
                                                                token,
                                                                item._id,
                                                            );
                                                            setItems((prev) =>
                                                                prev.map((entry) =>
                                                                    entry._id === item._id
                                                                        ? {
                                                                              ...entry,
                                                                              read: true,
                                                                          }
                                                                        : entry,
                                                                ),
                                                            );
                                                        } catch {
                                                            // Ignore mark-as-read error on navigation click.
                                                        }
                                                    }
                                                    setOpen(false);
                                                    if (shouldResolveMilestone) {
                                                        const targetHref =
                                                            await resolveMilestoneApprovedHref(
                                                                campaignId,
                                                            );
                                                        router.push(targetHref);
                                                    }
                                                }}
                                            >
                                                {linkLabel} →
                                            </Link>
                                        );
                                    })()}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </>
        ) : null;

    return (
        <div className="relative" ref={containerRef}>
            <button
                ref={bellButtonRef}
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="relative rounded-lg border border-[rgba(99,102,241,0.3)] bg-[rgba(99,102,241,0.1)] p-2 text-[var(--text-primary)] transition hover:bg-[rgba(99,102,241,0.2)]"
                aria-label="Thông báo"
            >
                <svg className="h-5 w-5 text-[var(--accent-cyan)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {unreadCount > 0 && (
                    <span className="notify-glow-dot absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                        {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                )}
            </button>
            {portalReady && panelContent
                ? createPortal(panelContent, document.body)
                : null}
        </div>
    );
}
