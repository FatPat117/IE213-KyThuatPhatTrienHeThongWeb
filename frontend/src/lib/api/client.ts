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

interface RpcFlowMetric {
    count: number;
    endpoints: Record<string, number>;
    startedAt: number;
}

interface RpcMetricStore {
    totalCalls: number;
    endpointCounts: Record<string, number>;
    flows: Record<string, RpcFlowMetric>;
}

declare global {
    interface Window {
        __rpcMetrics?: {
            start: (flowName: string) => void;
            end: (flowName?: string) => RpcFlowMetric | null;
            snapshot: () => ReturnType<typeof getRpcMetricsSnapshot>;
            reset: () => void;
        };
    }
}

const RPC_METRIC_STORE_KEY = "__ie213RpcMetricStore__";
const RPC_ACTIVE_FLOW_KEY = "__ie213RpcActiveFlow__";

function createEmptyRpcMetricStore(): RpcMetricStore {
    return {
        totalCalls: 0,
        endpointCounts: {},
        flows: {},
    };
}

function getRpcMetricStore(): RpcMetricStore {
    if (typeof window === "undefined") return createEmptyRpcMetricStore();
    const host = window as Window & {
        [RPC_METRIC_STORE_KEY]?: RpcMetricStore;
        [RPC_ACTIVE_FLOW_KEY]?: string;
    };
    if (!host[RPC_METRIC_STORE_KEY]) {
        host[RPC_METRIC_STORE_KEY] = createEmptyRpcMetricStore();
    }
    return host[RPC_METRIC_STORE_KEY]!;
}

function getActiveRpcFlowName(): string | null {
    if (typeof window === "undefined") return null;
    const host = window as Window & { [RPC_ACTIVE_FLOW_KEY]?: string };
    return host[RPC_ACTIVE_FLOW_KEY] || null;
}

function setActiveRpcFlowName(flowName: string | null) {
    if (typeof window === "undefined") return;
    const host = window as Window & { [RPC_ACTIVE_FLOW_KEY]?: string };
    if (flowName) {
        host[RPC_ACTIVE_FLOW_KEY] = flowName;
    } else {
        delete host[RPC_ACTIVE_FLOW_KEY];
    }
}

function ensureRpcDebugApi() {
    if (typeof window === "undefined") return;
    if (window.__rpcMetrics) return;
    window.__rpcMetrics = {
        start: startRpcMeasureFlow,
        end: endRpcMeasureFlow,
        snapshot: getRpcMetricsSnapshot,
        reset: resetRpcMetrics,
    };
}

function normalizeMetricEndpoint(endpoint: string): string {
    return endpoint.split("?")[0] || endpoint;
}

function incrementEndpointMap(
    endpointCounts: Record<string, number>,
    endpoint: string,
) {
    endpointCounts[endpoint] = (endpointCounts[endpoint] || 0) + 1;
}

function recordRpcCall(endpoint: string) {
    if (typeof window === "undefined") return;
    const store = getRpcMetricStore();
    const normalizedEndpoint = normalizeMetricEndpoint(endpoint);
    store.totalCalls += 1;
    incrementEndpointMap(store.endpointCounts, normalizedEndpoint);

    const activeFlow = getActiveRpcFlowName();
    if (!activeFlow) return;
    const flowMetric =
        store.flows[activeFlow] ||
        (store.flows[activeFlow] = {
            count: 0,
            endpoints: {},
            startedAt: Date.now(),
        });
    flowMetric.count += 1;
    incrementEndpointMap(flowMetric.endpoints, normalizedEndpoint);
}

export function resetRpcMetrics() {
    ensureRpcDebugApi();
    if (typeof window === "undefined") return;
    const host = window as Window & {
        [RPC_METRIC_STORE_KEY]?: RpcMetricStore;
        [RPC_ACTIVE_FLOW_KEY]?: string;
    };
    host[RPC_METRIC_STORE_KEY] = createEmptyRpcMetricStore();
    delete host[RPC_ACTIVE_FLOW_KEY];
}

export function startRpcMeasureFlow(flowName: string) {
    ensureRpcDebugApi();
    if (!flowName || typeof window === "undefined") return;
    const store = getRpcMetricStore();
    store.flows[flowName] = {
        count: 0,
        endpoints: {},
        startedAt: Date.now(),
    };
    setActiveRpcFlowName(flowName);
    console.info(`[RPC_METRICS] started flow: ${flowName}`);
}

export function endRpcMeasureFlow(flowName?: string) {
    ensureRpcDebugApi();
    if (typeof window === "undefined") return null;
    const store = getRpcMetricStore();
    const selectedFlow = flowName || getActiveRpcFlowName();
    if (!selectedFlow) return null;
    const result = store.flows[selectedFlow] || null;
    if (!flowName || flowName === selectedFlow) {
        setActiveRpcFlowName(null);
    }
    console.info(
        `[RPC_METRICS] flow result: ${selectedFlow}`,
        result
            ? {
                  count: result.count,
                  endpoints: result.endpoints,
                  durationMs: Date.now() - result.startedAt,
              }
            : null,
    );
    return result;
}

export function getRpcMetricsSnapshot() {
    ensureRpcDebugApi();
    const store = getRpcMetricStore();
    return {
        totalCalls: store.totalCalls,
        endpointCounts: { ...store.endpointCounts },
        flows: JSON.parse(JSON.stringify(store.flows)) as RpcMetricStore["flows"],
    };
}

export async function trackedFetch(
    input: RequestInfo | URL,
    init?: RequestInit,
    metricLabel?: string,
) {
    ensureRpcDebugApi();
    const endpoint =
        metricLabel ||
        (typeof input === "string"
            ? input
            : input instanceof URL
              ? input.pathname
              : input.url);
    recordRpcCall(endpoint);
    return fetch(input, init);
}

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
    ensureRpcDebugApi();
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
            recordRpcCall(path);
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
