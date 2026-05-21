// frontend/e2e/helpers/api.ts
// Helper functions để seed/clean test data qua API trong E2E tests

import { APIRequestContext } from '@playwright/test';

const BACKEND_URL = process.env.BACKEND_API_URL || 'http://localhost:4000';

/**
 * Gọi internal API để tạo campaign test trong DB (bypass blockchain).
 * Chỉ khả dụng trong môi trường test (NODE_ENV=test).
 */
export async function seedTestCampaign(
  request: APIRequestContext,
  data: {
    onChainId: number;
    status: string;
    title?: string;
    totalRaisedWei?: string;
    totalDisbursedWei?: string;
  }
) {
  const res = await request.post(`${BACKEND_URL}/api/campaigns/test/seed`, {
    data,
    headers: { 'x-test-secret': process.env.TEST_SECRET || 'test-secret' },
  });
  return res.json();
}

export async function cleanupTestData(request: APIRequestContext, onChainId: number) {
  await request.delete(`${BACKEND_URL}/api/campaigns/test/cleanup/${onChainId}`, {
    headers: { 'x-test-secret': process.env.TEST_SECRET || 'test-secret' },
  });
}
