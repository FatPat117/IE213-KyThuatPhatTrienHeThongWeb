'use client';

type CachedCampaignMetadata = {
  title?: string;
  description?: string;
  thumbnailUrl?: string;
  updatedAt: number;
};

const STORAGE_KEY = 'campaign_metadata_cache_v1';

function readCache(): Record<string, CachedCampaignMetadata> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, CachedCampaignMetadata>;
    return parsed ?? {};
  } catch {
    return {};
  }
}

function writeCache(next: Record<string, CachedCampaignMetadata>) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function saveCampaignMetadataToCache(
  campaignId: number,
  metadata: { title?: string; description?: string; thumbnailUrl?: string }
) {
  if (!Number.isFinite(campaignId) || campaignId <= 0) return;
  const cache = readCache();
  cache[String(campaignId)] = {
    title: metadata.title?.trim() || undefined,
    description: metadata.description?.trim() || undefined,
    thumbnailUrl: metadata.thumbnailUrl?.trim() || undefined,
    updatedAt: Date.now(),
  };
  writeCache(cache);
}

export function getCampaignMetadataFromCache(campaignId: number) {
  if (!Number.isFinite(campaignId) || campaignId <= 0) return null;
  const cache = readCache();
  return cache[String(campaignId)] ?? null;
}

export function isPlaceholderCampaignTitle(title?: string, campaignId?: number) {
  const normalized = (title || '').trim().toLowerCase();
  if (!normalized) return true;
  if (normalized === 'untitled campaign') return true;
  if (normalized.startsWith('campaign #')) return true;
  if (campaignId && normalized === `campaign ${campaignId}`.toLowerCase()) return true;
  return false;
}

export function isPlaceholderCampaignDescription(description?: string) {
  const normalized = (description || '').trim().toLowerCase();
  if (!normalized) return true;
  if (normalized === 'no description') return true;
  if (normalized.includes('stored on-chain without off-chain metadata')) return true;
  return false;
}

export function isPlaceholderThumbnailUrl(url?: string) {
  if (!url) return true;
  // Detected if it's a placehold.co URL or empty
  if (url.includes('placehold.co')) return true;
  return false;
}
