"use client";

import { ApiRequestError, apiRequest } from "./client";

export interface ReviewerProfile {
  reviewerCode: string | null;
  walletAddress: string;
  organizationName: string;
  region: string;
  isActive?: boolean;
}

/**
 * GET hồ sơ reviewer. Nếu API trả 404 (route/deploy cũ hoặc gateway), coi như chưa có bản ghi — không chặn form.
 */
export async function getReviewerProfile(
  token: string | null,
  fallbackWallet = "",
) {
  try {
    return await apiRequest<ReviewerProfile>("/campaigns/reviewers/profile", {
      token,
    });
  } catch (e) {
    if (e instanceof ApiRequestError && e.status === 404) {
      return {
        reviewerCode: null,
        walletAddress: fallbackWallet,
        organizationName: "",
        region: "",
        isActive: true,
      } satisfies ReviewerProfile;
    }
    throw e;
  }
}

let publicReviewerProfilesCache: {
  data: ReviewerProfile[];
  expiresAt: number;
} | null = null;

const PUBLIC_REVIEWER_PROFILES_TTL_MS = 300_000;

/** Danh sách hồ sơ reviewer công khai (tổ chức, vùng phụ trách) — dùng trang chủ */
export async function getPublicReviewerProfiles(): Promise<ReviewerProfile[]> {
  if (
    publicReviewerProfilesCache &&
    Date.now() <= publicReviewerProfilesCache.expiresAt
  ) {
    return publicReviewerProfilesCache.data;
  }
  const data = await apiRequest<ReviewerProfile[]>(
    "/campaigns/public/reviewers/profiles",
  );
  publicReviewerProfilesCache = {
    data: Array.isArray(data) ? data : [],
    expiresAt: Date.now() + PUBLIC_REVIEWER_PROFILES_TTL_MS,
  };
  return publicReviewerProfilesCache.data;
}

export async function updateReviewerProfile(
  token: string | null,
  updates: { organizationName?: string; region?: string },
) {
  return apiRequest<ReviewerProfile>("/campaigns/reviewers/profile", {
    method: "PATCH",
    token,
    body: JSON.stringify(updates),
  });
}
