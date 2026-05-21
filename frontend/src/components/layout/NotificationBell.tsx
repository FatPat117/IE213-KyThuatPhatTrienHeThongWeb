"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
        const onClickAway = (event: MouseEvent) => {
            if (!containerRef.current) return;
            if (!containerRef.current.contains(event.target as Node)) {
                setOpen(false);
            }
        };
        window.addEventListener("mousedown", onClickAway);
        return () => window.removeEventListener("mousedown", onClickAway);
    }, []);

    if (!token) return null;

    return (
        <div className="relative" ref={containerRef}>
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="relative rounded-lg border border-slate-200 bg-white p-2 text-slate-700 hover:bg-slate-50"
                aria-label="Thông báo"
            >
                🔔
                {unreadCount > 0 && (
                    <span className="absolute -right-1 -top-1 rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
                        {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                )}
            </button>
            {open && (
                <div className="absolute right-0 z-50 mt-2 w-80 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
                    <div className="mb-2 flex items-center justify-between">
                        <p className="text-sm font-semibold text-slate-900">
                            Thông báo mới
                        </p>
                        <div className="flex items-center gap-2">
                            <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                    realtimeConnected
                                        ? "bg-emerald-100 text-emerald-700"
                                        : "bg-amber-100 text-amber-700"
                                }`}
                            >
                                {realtimeConnected ? "Realtime" : "Đang kết nối"}
                            </span>
                            <button
                                type="button"
                                className="text-xs text-blue-600 hover:text-blue-700"
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
                    <div className="max-h-80 space-y-2 overflow-auto">
                        {isLoading && (
                            <p className="text-xs text-slate-500">Đang tải thông báo...</p>
                        )}
                        {items.length === 0 ? (
                            <p className="text-xs text-slate-500">
                                Chưa có thông báo.
                            </p>
                        ) : (
                            items.map((item) => (
                                <div
                                    key={item._id}
                                    className={`rounded-lg border px-3 py-2 text-xs ${item.read ? "border-slate-200 bg-slate-50" : "border-blue-200 bg-blue-50"}`}
                                >
                                    <p className="font-semibold text-slate-800">
                                        {item.title}
                                    </p>
                                    <p className="mt-1 text-slate-600">
                                        {item.message}
                                    </p>
                                    <p className="mt-1 text-[10px] text-slate-500">
                                        {formatTime(item.createdAt)}
                                    </p>
                                    {(() => {
                                        // Smart routing: redirect to appropriate page based on notification type
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
                                                className="mt-1 inline-block text-blue-600 text-[11px] font-medium hover:underline"
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
            )}
        </div>
    );
}
