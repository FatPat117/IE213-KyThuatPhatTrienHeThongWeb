"use client";

import { getBackendErrorMessage } from "../errors/normalize";

const DEFAULT_API_BASE_URL = "http://localhost:4000/api";
const RETRYABLE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const MAX_RATE_LIMIT_RETRIES = 4;
const INITIAL_BACKOFF_MS = 400;
const MAX_BACKOFF_MS = 5000;

function normalizeApiBaseUrl(rawUrl?: string) {
    const trimmed = rawUrl?.trim();
    if (!trimmed) return DEFAULT_API_BASE_URL;

    const withoutTrailingSlash = trimmed.replace(/\/+$/, "");
    return withoutTrailingSlash.endsWith("/api")
        ? withoutTrailingSlash
        : `${withoutTrailingSlash}/api`;
}

export const API_BASE_URL = normalizeApiBaseUrl(
    process.env.NEXT_PUBLIC_API_URL,
);

export interface ApiSuccess<T> {
    success: true;
    data: T;
}

export interface ApiError {
    success: false;
    error: string;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

class ApiRequestError extends Error {
    status?: number;
    rawMessage?: string;

    constructor(message: string, status?: number, rawMessage?: string) {
        super(message);
        this.name = "ApiRequestError";
        this.status = status;
        this.rawMessage = rawMessage;
    }
}

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRetryAfterMs(value: string | null): number | null {
    if (!value) return null;

    const seconds = Number(value);
    if (Number.isFinite(seconds) && seconds >= 0) {
        return Math.floor(seconds * 1000);
    }

    const dateTs = Date.parse(value);
    if (!Number.isNaN(dateTs)) {
        const delta = dateTs - Date.now();
        return delta > 0 ? delta : 0;
    }

    return null;
}

/**
 * Small fetch wrapper for backend gateway APIs.
 * It normalizes success/error response shape from all services.
 */
export async function apiRequest<T>(
    path: string,
    init?: RequestInit & { token?: string | null; timeoutMs?: number },
): Promise<T> {
    const headers = new Headers(init?.headers || {});
    headers.set("Content-Type", "application/json");
    headers.set("Cache-Control", "no-cache");
    headers.set("Pragma", "no-cache");
    if (init?.token) headers.set("Authorization", `Bearer ${init.token}`);

    const method = (init?.method || "GET").toUpperCase();
    const canRetry = RETRYABLE_METHODS.has(method);
    const maxAttempts = canRetry ? MAX_RATE_LIMIT_RETRIES + 1 : 1;
    let attempt = 0;

    while (attempt < maxAttempts) {
        const timeoutMs = init?.timeoutMs;
        const timeoutController =
            typeof timeoutMs === "number" && timeoutMs > 0
                ? new AbortController()
                : null;
        const relayAbortController = new AbortController();
        const signal = timeoutController
            ? timeoutController.signal
            : relayAbortController.signal;
        let timeoutId: ReturnType<typeof setTimeout> | null = null;

        const onCallerAbort = () => relayAbortController.abort();
        if (init?.signal) {
            if (init.signal.aborted) {
                relayAbortController.abort();
            } else {
                init.signal.addEventListener("abort", onCallerAbort, {
                    once: true,
                });
            }
        }

        if (timeoutController && timeoutMs) {
            timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs);
        }

        let response: Response;
        try {
            response = await fetch(`${API_BASE_URL}${path}`, {
                ...init,
                cache: "no-store",
                headers,
                signal,
            });
        } catch (error) {
            if (timeoutId) clearTimeout(timeoutId);
            if (init?.signal) {
                init.signal.removeEventListener("abort", onCallerAbort);
            }

            if (
                error instanceof Error &&
                error.name === "AbortError" &&
                timeoutController
            ) {
                throw new ApiRequestError(
                    getBackendErrorMessage("Request timeout", {
                        fallback: "Yêu cầu quá thời gian. Vui lòng thử lại.",
                    }),
                );
            }
            throw new ApiRequestError(
                getBackendErrorMessage(error, {
                    fallback: "Lỗi mạng. Vui lòng kiểm tra kết nối.",
                }),
            );
        } finally {
            if (timeoutId) clearTimeout(timeoutId);
            if (init?.signal) {
                init.signal.removeEventListener("abort", onCallerAbort);
            }
        }

        if (response.status === 429 && attempt < maxAttempts - 1) {
            const retryAfterMs = parseRetryAfterMs(
                response.headers.get("Retry-After"),
            );
            const exponentialBackoff = Math.min(
                INITIAL_BACKOFF_MS * 2 ** attempt,
                MAX_BACKOFF_MS,
            );
            // Add jitter to avoid synchronized retries across clients.
            const jitter = Math.floor(Math.random() * 250);
            const waitMs = Math.max(
                retryAfterMs ?? 0,
                exponentialBackoff + jitter,
            );
            await sleep(waitMs);
            attempt += 1;
            continue;
        }

        let payload: ApiResponse<T> | null = null;
        let rawBody = "";
        try {
            rawBody = await response.text();
            payload = rawBody ? (JSON.parse(rawBody) as ApiResponse<T>) : null;
        } catch {
            payload = null;
        }

        if (!response.ok || payload?.success === false) {
            const rawMessage =
                (payload && "error" in payload && payload.error) ||
                (payload as { message?: string } | null)?.message ||
                rawBody ||
                "";
            const userMessage = getBackendErrorMessage(rawMessage, {
                status: response.status,
            });
            throw new ApiRequestError(userMessage, response.status, rawMessage);
        }

        if (!payload || payload.success !== true) {
            throw new ApiRequestError(
                getBackendErrorMessage("Request failed", {
                    status: response.status,
                    fallback: "Yêu cầu thất bại.",
                }),
                response.status,
                rawBody,
            );
        }

        return payload.data;
    }

    throw new ApiRequestError("Request failed after retries");
}
