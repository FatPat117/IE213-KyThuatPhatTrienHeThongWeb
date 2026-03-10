'use client';

const DEFAULT_API_BASE_URL = 'http://localhost:4000/api';

function normalizeApiBaseUrl(rawUrl?: string) {
  const trimmed = rawUrl?.trim();
  if (!trimmed) return DEFAULT_API_BASE_URL;

  const withoutTrailingSlash = trimmed.replace(/\/+$/, '');
  return withoutTrailingSlash.endsWith('/api')
    ? withoutTrailingSlash
    : `${withoutTrailingSlash}/api`;
}

export const API_BASE_URL = normalizeApiBaseUrl(process.env.NEXT_PUBLIC_API_URL);

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiError {
  success: false;
  error: string;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

/**
 * Small fetch wrapper for backend gateway APIs.
 * It normalizes success/error response shape from all services.
 */
export async function apiRequest<T>(
  path: string,
  init?: RequestInit & { token?: string | null }
): Promise<T> {
  const headers = new Headers(init?.headers || {});
  headers.set('Content-Type', 'application/json');
  if (init?.token) headers.set('Authorization', `Bearer ${init.token}`);

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  });

  const payload = (await response.json()) as ApiResponse<T>;
  if (!response.ok || !payload.success) {
    throw new Error(payload.success ? 'Request failed' : payload.error);
  }

  return payload.data;
}
