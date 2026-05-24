"use client";

import { apiRequest } from "./client";

export interface ReviewerProfileAdminRecord {
  reviewerCode: string | null;
  walletAddress: string;
  organizationName: string;
  region: string;
  isActive: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

export async function getAdminReviewerProfiles(token: string | null) {
  return apiRequest<ReviewerProfileAdminRecord[]>(
    "/campaigns/reviewers/admin/profiles",
    { token },
  );
}

export async function patchAdminReviewerProfile(
  token: string | null,
  walletAddress: string,
  updates: {
    organizationName?: string;
    region?: string;
    isActive?: boolean;
  },
) {
  const path = `/campaigns/reviewers/admin/profiles/${encodeURIComponent(walletAddress.trim())}`;
  return apiRequest<ReviewerProfileAdminRecord>(path, {
    method: "PATCH",
    token,
    body: JSON.stringify(updates),
  });
}

/** Xóa nội dung hồ sơ (tổ chức, tỉnh/thành về rỗng); giữ ví và mã reviewer. */
export async function clearAdminReviewerProfile(
  token: string | null,
  walletAddress: string,
) {
  const path = `/campaigns/reviewers/admin/profiles/${encodeURIComponent(walletAddress.trim())}`;
  return apiRequest<ReviewerProfileAdminRecord>(path, {
    method: "DELETE",
    token,
  });
}
