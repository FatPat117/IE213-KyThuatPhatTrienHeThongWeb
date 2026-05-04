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
