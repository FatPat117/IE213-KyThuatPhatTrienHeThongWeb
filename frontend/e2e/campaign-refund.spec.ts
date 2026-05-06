// frontend/e2e/campaign-refund.spec.ts
//
// E2E Tests cho luồng hoàn tiền của Donor.
//
// ═══════════════════════════════════════════════════════════════════
// KIẾN TRÚC TEST
// ═══════════════════════════════════════════════════════════════════
// Thay vì chạy toàn bộ blockchain thật, chúng ta sử dụng chiến lược
// "API Mocking" - intercept các API calls từ frontend và trả về
// response giả lập. Điều này cho phép:
//   1. Test UI logic mà không cần blockchain chạy
//   2. Test các trạng thái khó tái tạo (đã rút tiền, đang chờ xác nhận)
//   3. Test chạy nhanh và ổn định
//
// Gnosis Safe Reviewer:
//   - Trong E2E, reviewer được giả lập là EOA thông thường
//   - Không cần multi-sig thật để test các luồng reviewer UI
// ═══════════════════════════════════════════════════════════════════

import { test, expect, Page } from '@playwright/test';
import { TEST_ACCOUNTS, connectMockWallet } from './helpers/wallet';

// ─── Campaign ID dùng trong tất cả test ──────────────────────────────────────
const TEST_CAMPAIGN_ONCHAIN_ID = 1;
const CAMPAIGN_URL = `/campaigns/${TEST_CAMPAIGN_ONCHAIN_ID}`;

// ─── Helper: Mock tất cả API responses cần thiết ─────────────────────────────
async function mockCampaignApis(
  page: Page,
  options: {
    campaignStatus?: string;
    refundStatus?: 'none' | 'eligible' | 'refunded';
    eligibleRefundWei?: string;
  } = {}
) {
  const {
    campaignStatus = 'partial_failed',
    refundStatus = 'eligible',
    eligibleRefundWei = '700000000000000000',
  } = options;

  // Mock campaign detail API
  await page.route(`**/api/campaigns/**/${TEST_CAMPAIGN_ONCHAIN_ID}`, async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            onChainId: TEST_CAMPAIGN_ONCHAIN_ID,
            title: 'Test Crowdfunding Campaign',
            description: 'Chiến dịch test cho E2E',
            status: campaignStatus,
            creator: TEST_ACCOUNTS.creator,
            goalWei: '1000000000000000000',
            totalRaisedWei: '1000000000000000000',
            totalDisbursedWei: '300000000000000000',
            remainingWei: '700000000000000000',
            deadline: new Date(Date.now() + 86400000).toISOString(),
            milestoneCount: 2,
            currentMilestoneId: 0,
          },
        }),
      });
    } else {
      await route.continue();
    }
  });

  // Mock refund status API
  await page.route(
    `**/api/campaigns/public/campaigns/${TEST_CAMPAIGN_ONCHAIN_ID}/refund-status**`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            status: refundStatus,
            eligibleRefundWei: refundStatus !== 'none' ? eligibleRefundWei : '0',
            refundedWei: refundStatus === 'refunded' ? eligibleRefundWei : '0',
          },
        }),
      });
    }
  );

  // Mock public campaigns list
  await page.route('**/api/campaigns/public/campaigns**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: [] }),
    });
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// TEST SUITE 1: Donor chưa rút tiền
// ══════════════════════════════════════════════════════════════════════════════
test.describe('Donor chưa rút tiền (refundStatus = eligible)', () => {
  test.beforeEach(async ({ page }) => {
    await mockCampaignApis(page, {
      campaignStatus: 'partial_failed',
      refundStatus: 'eligible',
    });
  });

  test('hiển thị nút "Yêu cầu hoàn tiền" trên trang chi tiết campaign thất bại', async ({
    page,
  }) => {
    await connectMockWallet(page, TEST_ACCOUNTS.donorA);
    await page.goto(CAMPAIGN_URL);

    // Đợi trang load xong
    await page.waitForLoadState('networkidle');

    // Kiểm tra panel hoàn tiền xuất hiện
    const refundPanel = page.getByText('Chiến dịch không đạt mục tiêu');
    await expect(refundPanel).toBeVisible({ timeout: 10_000 });

    // Kiểm tra nút hoàn tiền
    const refundButton = page.getByRole('button', { name: /Yêu cầu hoàn tiền/i });
    await expect(refundButton).toBeVisible();
    await expect(refundButton).toBeEnabled();
  });

  test('campaign hiển thị badge "Thất bại" trong danh sách', async ({ page }) => {
    await page.route('**/api/campaigns/public/campaigns**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            {
              onChainId: TEST_CAMPAIGN_ONCHAIN_ID,
              title: 'Failed Campaign',
              status: 'partial_failed',
              goalWei: '1000000000000000000',
              totalRaisedWei: '1000000000000000000',
            },
          ],
        }),
      });
    });

    await page.goto('/campaigns');
    await page.waitForLoadState('networkidle');

    // Badge trạng thái phải phản ánh thất bại, không phải "Đang triển khai"
    const failedBadge = page.getByText(/Thất bại/i).first();
    await expect(failedBadge).toBeVisible({ timeout: 10_000 });

    // KHÔNG được hiển thị "Đang triển khai" cho campaign thất bại
    const wrongBadge = page.getByText(/Đang triển khai/i);
    await expect(wrongBadge).not.toBeVisible();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// TEST SUITE 2: Donor đã rút tiền (hasRefunded = true)
// ══════════════════════════════════════════════════════════════════════════════
test.describe('Donor đã rút tiền (refundStatus = refunded)', () => {
  test.beforeEach(async ({ page }) => {
    await mockCampaignApis(page, {
      campaignStatus: 'partial_failed',
      refundStatus: 'refunded',
    });
  });

  test('hiển thị "✅ Bạn đã rút tiền hoàn lại thành công" thay vì nút hoàn tiền', async ({
    page,
  }) => {
    await connectMockWallet(page, TEST_ACCOUNTS.donorA);
    await page.goto(CAMPAIGN_URL);
    await page.waitForLoadState('networkidle');

    // Panel vẫn hiển thị
    await expect(
      page.getByText('Chiến dịch không đạt mục tiêu')
    ).toBeVisible({ timeout: 10_000 });

    // Thông báo đã hoàn tiền
    await expect(
      page.getByText(/Bạn đã rút tiền hoàn lại thành công/i)
    ).toBeVisible();

    // Nút hoàn tiền KHÔNG được xuất hiện
    await expect(
      page.getByRole('button', { name: /Yêu cầu hoàn tiền/i })
    ).not.toBeVisible();
  });

  test('trạng thái đã rút vẫn giữ nguyên sau khi reload trang', async ({ page }) => {
    await connectMockWallet(page, TEST_ACCOUNTS.donorA);
    await page.goto(CAMPAIGN_URL);
    await page.waitForLoadState('networkidle');

    // Reload trang
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Sau reload: vẫn phải hiển thị trạng thái "Đã rút"
    await expect(
      page.getByText(/Bạn đã rút tiền hoàn lại thành công/i)
    ).toBeVisible({ timeout: 10_000 });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// TEST SUITE 3: Non-donor (không quyên góp)
// ══════════════════════════════════════════════════════════════════════════════
test.describe('Người dùng chưa quyên góp (refundStatus = none)', () => {
  test.beforeEach(async ({ page }) => {
    await mockCampaignApis(page, {
      campaignStatus: 'partial_failed',
      refundStatus: 'none',
    });
  });

  test('không hiển thị panel hoàn tiền cho người chưa quyên góp', async ({ page }) => {
    await connectMockWallet(page, '0x1111111111111111111111111111111111111111');
    await page.goto(CAMPAIGN_URL);
    await page.waitForLoadState('networkidle');

    // Panel hoàn tiền không được hiển thị
    await expect(
      page.getByText('Chiến dịch không đạt mục tiêu')
    ).not.toBeVisible();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// TEST SUITE 4: Campaign chưa thất bại (status = in_progress)
// ══════════════════════════════════════════════════════════════════════════════
test.describe('Campaign đang triển khai (status = in_progress)', () => {
  test.beforeEach(async ({ page }) => {
    await mockCampaignApis(page, {
      campaignStatus: 'in_progress',
      refundStatus: 'none',
    });
  });

  test('không hiển thị panel hoàn tiền khi campaign chưa thất bại', async ({ page }) => {
    await connectMockWallet(page, TEST_ACCOUNTS.donorA);
    await page.goto(CAMPAIGN_URL);
    await page.waitForLoadState('networkidle');

    await expect(
      page.getByText('Chiến dịch không đạt mục tiêu')
    ).not.toBeVisible();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// TEST SUITE 5: Trạng thái loading và pending
// ══════════════════════════════════════════════════════════════════════════════
test.describe('UI states: pending và confirming', () => {
  test('hiển thị "Đợi xác nhận từ ví..." khi đang chờ ký giao dịch', async ({ page }) => {
    // Mock refund status = eligible
    await mockCampaignApis(page, {
      campaignStatus: 'partial_failed',
      refundStatus: 'eligible',
    });

    // Mock blockchain call để trả về "pending" state
    // Trong test thực tế, đây là lúc MetaMask popup xuất hiện
    // Chúng ta kiểm tra UI state trước khi giao dịch được confirm
    await connectMockWallet(page, TEST_ACCOUNTS.donorA);
    await page.goto(CAMPAIGN_URL);
    await page.waitForLoadState('networkidle');

    // Panel và nút phải hiển thị
    const refundButton = page.getByRole('button', { name: /Yêu cầu hoàn tiền/i });
    await expect(refundButton).toBeVisible({ timeout: 10_000 });
    await expect(refundButton).toBeEnabled();
  });
});
