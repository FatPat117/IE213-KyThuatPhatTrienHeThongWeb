'use client';

import { apiRequest } from './client';
import type { CampaignRecord } from './types';

export async function getCampaigns() {
  return apiRequest<CampaignRecord[]>('/campaigns');
}

export async function getCampaignById(id: number) {
  return apiRequest<CampaignRecord>(`/campaigns/${id}`);
}

export async function updateCampaignMetadata(
  id: number,
  token: string,
  updates: { title?: string; description?: string; images?: string[] }
) {
  return apiRequest<CampaignRecord>(`/campaigns/${id}/metadata`, {
    method: 'PUT',
    token,
    body: JSON.stringify(updates),
  });
}
