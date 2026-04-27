'use client';

import { apiRequest } from './client';
import type { DonationRecord } from './types';

export async function getDonationsByCampaign(campaignId: number) {
  return apiRequest<DonationRecord[]>(`/donations/campaign/${campaignId}`);
}

export async function getDonationsByCampaignAndWallet(campaignId: number, wallet: string) {
  return apiRequest<DonationRecord[]>(`/donations/campaign/${campaignId}/donor/${wallet}`);
}

export async function getDonationsByWallet(wallet: string) {
  return apiRequest<DonationRecord[]>(`/donations/donor/${wallet}`);
}
