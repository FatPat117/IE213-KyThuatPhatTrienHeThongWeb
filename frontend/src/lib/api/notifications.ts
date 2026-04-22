"use client";

import { API_BASE_URL, apiRequest } from "./client";

export interface NotificationItem {
    _id: string;
    recipientWallet: string;
    type: string;
    title: string;
    message: string;
    campaignOnChainId: number | null;
    txHash: string;
    read: boolean;
    createdAt: string;
}

export async function getMyNotifications(token: string, limit = 20) {
    return apiRequest<NotificationItem[]>(`/notifications/me?limit=${limit}`, {
        token,
    });
}

export async function markNotificationAsRead(token: string, id: string) {
    return apiRequest<NotificationItem>(`/notifications/${id}/read`, {
        method: "PATCH",
        token,
    });
}

export async function markAllNotificationsAsRead(token: string) {
    return apiRequest<boolean>("/notifications/read-all", {
        method: "PATCH",
        token,
    });
}

export function openNotificationStream(
    token: string,
    onNotification: (item: NotificationItem) => void,
    onConnected?: () => void,
    signal?: AbortSignal,
) {
    return fetch(`${API_BASE_URL}/notifications/stream`, {
        method: "GET",
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: "text/event-stream",
            "Cache-Control": "no-cache",
        },
        signal,
    }).then(async (response) => {
        if (!response.ok || !response.body) {
            throw new Error("Không thể mở kết nối realtime thông báo.");
        }
        if (onConnected) onConnected();

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            const frames = buffer.split("\n\n");
            buffer = frames.pop() || "";

            for (const frame of frames) {
                if (!frame.includes("event: notification")) continue;
                const lines = frame.split("\n");
                const dataLine = lines.find((line) => line.startsWith("data:"));
                if (!dataLine) continue;
                const rawJson = dataLine.slice("data:".length).trim();
                try {
                    const payload = JSON.parse(rawJson) as NotificationItem;
                    onNotification(payload);
                } catch {
                    // Ignore malformed SSE payload and keep stream alive.
                }
            }
        }
    });
}
