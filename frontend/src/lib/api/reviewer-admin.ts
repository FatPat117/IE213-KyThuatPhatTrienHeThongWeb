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
