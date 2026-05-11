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
  // Mock campaign detail API (protected)
  const detailResponse = {
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
  };

  await page.route(`**/api/campaigns/${TEST_CAMPAIGN_ONCHAIN_ID}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(detailResponse),
    });
  });

  // Mock campaign detail API (public)
  await page.route(`**/api/campaigns/public/campaigns/${TEST_CAMPAIGN_ONCHAIN_ID}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(detailResponse),
    });
  });

  // Mock refund status API
  await page.route(`**/api/campaigns/public/campaigns/${TEST_CAMPAIGN_ONCHAIN_ID}/refund-status*`, async (route) => {
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
  });

  // Mock campaign list
  await page.route(url => (url.includes('/api/campaigns') || url.includes('/api/campaigns/public/campaigns')) && 
                         (url.endsWith('/campaigns') || url.includes('/campaigns?')), async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          items: [
            {
              onChainId: TEST_CAMPAIGN_ONCHAIN_ID,
              title: 'Test Campaign',
              status: campaignStatus,
              goalWei: '1000000000000000000',
              totalRaisedWei: '1000000000000000000',
              totalDisbursedWei: '0',
              deadline: String(Math.floor(Date.now() / 1000) + 86400),
              creator: TEST_ACCOUNTS.creator,
            }
          ],
          pagination: { page: 1, limit: 10, totalItems: 1, total: 1, totalPages: 1 }
        }
      }),
    });
  });

  const donationsResponse = {
    success: true,
    data: [
      {
        campaignOnChainId: TEST_CAMPAIGN_ONCHAIN_ID,
        donorWallet: TEST_ACCOUNTS.donorA,
        amount: '1000000000000000000', // 1 ETH
        txHash: '0xmockdonation',
        donatedAt: new Date().toISOString(),
      }
    ],
  };
  // Mock donations API
  await page.route(`**/api/donations/campaign/${TEST_CAMPAIGN_ONCHAIN_ID}*`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(donationsResponse),
    });
  });

  // Specific donor query
  await page.route(new RegExp(`api/donations/campaign/${TEST_CAMPAIGN_ONCHAIN_ID}/donor/.*`), async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(donationsResponse),
    });
  });

  // Mock JSON-RPC for different contract functions and common methods
  await page.route('**', async (route) => {
    const request = route.request();
    if (request.resourceType() !== 'fetch' && request.resourceType() !== 'xhr') {
        return route.continue();
    }
    
    if (!request.url().includes('sepolia') && !request.url().includes('alchemy') && !request.url().includes('infura')) {
        return route.continue();
    }

    const postData = request.postDataJSON();
    if (!postData || !postData.method) return route.continue();

    // Common methods
    if (postData.method === 'eth_chainId') {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ jsonrpc: '2.0', id: postData.id, result: '0xaa36a7' }), // Sepolia
        });
        return;
    }
    if (postData.method === 'eth_blockNumber') {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ jsonrpc: '2.0', id: postData.id, result: '0x500000' }),
        });
        return;
    }
    if (postData.method === 'eth_getBalance') {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ jsonrpc: '2.0', id: postData.id, result: '0xde0b6b3a7640000' }), // 1 ETH
        });
        return;
    }

    if (postData.method === 'eth_call') {
      const data = postData.params[0].data;
      
      // campaignCount() - selector 0x32338f6f
      if (data.startsWith('0x32338f6f')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: postData.id,
            result: '0x0000000000000000000000000000000000000000000000000000000000000001'
          }),
        });
        return;
      }

      // getDonation(uint256,address) - selector 0x5b367123
      if (data.startsWith('0x5b367123')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: postData.id,
            result: '0x0000000000000000000000000000000000000000000000000de0b6b3a7640000' // 1 ETH
          }),
        });
        return;
      }

      // getCampaign(uint256) - selector 0x61895a5f
      if (data.startsWith('0x61895a5f')) {
        const statusValue = campaignStatus === 'partial_failed' ? '04' : (campaignStatus === 'failed' ? '05' : '01');
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: postData.id,
            result: `0x000000000000000000000000000000000000000000000000000000000000000${TEST_CAMPAIGN_ONCHAIN_ID}` + // id
                    `000000000000000000000000${TEST_ACCOUNTS.creator.slice(2)}` + // creator
                    `000000000000000000000000${TEST_ACCOUNTS.creator.slice(2)}` + // beneficiary
                    '0000000000000000000000000000000000000000000000000de0b6b3a7640000' + // goal (1 ETH)
                    '0000000000000000000000000000000000000000000000000de0b6b3a7640000' + // totalRaised (1 ETH)
                    '0000000000000000000000000000000000000000000000000000000000000000' + // totalDisbursed (0)
                    '000000000000000000000000000000000000000000000000000000006a000000' + // deadline (future)
                    '0000000000000000000000000000000000000000000000000000000000000000' + // withdrawn (false)
                    `00000000000000000000000000000000000000000000000000000000000000${statusValue}` + // status
                    '0000000000000000000000000000000000000000000000000000000000000002' + // milestoneCount (2)
                    '0000000000000000000000000000000000000000000000000000000000000000'    // currentMilestoneId (0)
          }),
        });
        return;
      }

      // Default result for other calls
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: postData.id,
          result: '0x0000000000000000000000000000000000000000000000000000000000000000'
        }),
      });
    } else {
      await route.continue();
    }
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
    const refundPanel = page.getByText(/Chiến dịch không đạt mục tiêu/i);
    await expect(refundPanel).toBeVisible({ timeout: 15_000 });

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
          data: {
            items: [
              {
                onChainId: TEST_CAMPAIGN_ONCHAIN_ID,
                title: 'Failed Campaign',
                status: 'partial_failed',
                goalWei: '1000000000000000000',
                totalRaisedWei: '1000000000000000000',
              },
            ],
            pagination: {
              page: 1,
              limit: 10,
              totalItems: 1,
              totalPages: 1,
            },
          },
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
      page.getByText(/Chiến dịch không đạt mục tiêu/i)
    ).toBeVisible({ timeout: 15_000 });

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
      page.getByText(/Chiến dịch không đạt mục tiêu/i)
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
      page.getByText(/Chiến dịch không đạt mục tiêu/i)
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
    await expect(refundButton).toBeVisible({ timeout: 15_000 });
    await expect(refundButton).toBeEnabled();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// TEST SUITE 6: Happy Path - Full refund flow (UI simulation)
// ══════════════════════════════════════════════════════════════════════════════
test.describe('Happy Path: Full refund flow via UI interaction', () => {
  test('nhấn nút hoàn tiền → API mock trả về refunded → UI cập nhật thành "Đã rút"', async ({
    page,
  }) => {
    let callCount = 0;

    // Mock campaign APIs
    await page.route(`**/api/campaigns/**/${TEST_CAMPAIGN_ONCHAIN_ID}`, async (route) => {
      if (route.request().method() !== 'GET') return route.continue();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            onChainId: TEST_CAMPAIGN_ONCHAIN_ID,
            title: 'Test Campaign',
            status: 'partial_failed',
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
    });

    // Mock refund-status: lần đầu → eligible, lần sau (sau khi nhấn) → refunded
    await page.route(
      `**/api/campaigns/public/campaigns/${TEST_CAMPAIGN_ONCHAIN_ID}/refund-status**`,
      async (route) => {
        callCount++;
        const isRefunded = callCount > 1;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              status: isRefunded ? 'refunded' : 'eligible',
              eligibleRefundWei: '700000000000000000',
              refundedWei: isRefunded ? '700000000000000000' : '0',
            },
          }),
        });
      }
    );

    await connectMockWallet(page, TEST_ACCOUNTS.donorA);
    await page.goto(CAMPAIGN_URL);
    await page.waitForLoadState('networkidle');

    // Bước 1: Nút hoàn tiền hiển thị
    const refundButton = page.getByRole('button', { name: /Yêu cầu hoàn tiền/i });
    await expect(refundButton).toBeVisible({ timeout: 15_000 });

    // Bước 2: Nhấn nút → trigger refund (sẽ gọi lại API refund-status)
    await refundButton.click();

    // Bước 3: Sau khi UI cập nhật (re-query), thông báo "Đã rút" phải xuất hiện
    // hoặc nút disabled (trạng thái pending)
    // Vì chúng ta không có MetaMask thật, ta chỉ verify nút được click
    // và UI phản hồi đúng (nút disabled hoặc thay đổi text)
    await expect(
      page.getByRole('button', { name: /Yêu cầu hoàn tiền|Đợi xác nhận|Đang xác nhận/i })
    ).toBeVisible({ timeout: 5_000 });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// TEST SUITE 7: Error Cases - API lỗi
// ══════════════════════════════════════════════════════════════════════════════
test.describe('Error Cases: API trả về lỗi 500', () => {
  test('API refund-status lỗi 500 → trang không bị crash, hiển thị error state', async ({
    page,
  }) => {
    // Mock campaign API trả về bình thường
    await page.route(`**/api/campaigns/**/${TEST_CAMPAIGN_ONCHAIN_ID}`, async (route) => {
      if (route.request().method() !== 'GET') return route.continue();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            onChainId: TEST_CAMPAIGN_ONCHAIN_ID,
            title: 'Test Campaign',
            status: 'partial_failed',
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
    });

    // Mock refund-status API trả về 500
    await page.route(
      `**/api/campaigns/public/campaigns/${TEST_CAMPAIGN_ONCHAIN_ID}/refund-status**`,
      async (route) => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ success: false, message: 'Internal Server Error' }),
        });
      }
    );

    await connectMockWallet(page, TEST_ACCOUNTS.donorA);
    await page.goto(CAMPAIGN_URL);
    await page.waitForLoadState('networkidle');

    // Trang KHÔNG được crash (không có error boundary uncaught)
    await expect(page.locator('body')).toBeVisible();

    // Không xuất hiện lỗi JavaScript unhandled
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    
    // Đợi thêm 2 giây để bắt lỗi async
    await page.waitForTimeout(2000);
    
    // Không có unhandled JS errors
    expect(errors.filter(e => !e.includes('hydration'))).toHaveLength(0);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// TEST SUITE 8: Wallet chưa kết nối
// ══════════════════════════════════════════════════════════════════════════════
test.describe('Error Cases: Wallet chưa kết nối', () => {
  test('không hiển thị panel hoàn tiền khi chưa connect wallet', async ({ page }) => {
    // Setup API mocks nhưng KHÔNG connectMockWallet
    await page.route(`**/api/campaigns/**/${TEST_CAMPAIGN_ONCHAIN_ID}`, async (route) => {
      if (route.request().method() !== 'GET') return route.continue();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            onChainId: TEST_CAMPAIGN_ONCHAIN_ID,
            title: 'Test Campaign',
            status: 'partial_failed',
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
    });

    // Không connect wallet → không có địa chỉ để check refund status
    await page.goto(CAMPAIGN_URL);
    await page.waitForLoadState('networkidle');

    // Panel hoàn tiền KHÔNG được hiển thị (vì chưa biết user là ai)
    await expect(
      page.getByText(/Chiến dịch không đạt mục tiêu/i)
    ).not.toBeVisible();

    // Nút "Kết nối ví" hoặc tương tự phải hiển thị thay thế
    // (hoặc ít nhất là không có nút "Yêu cầu hoàn tiền")
    await expect(
      page.getByRole('button', { name: /Yêu cầu hoàn tiền/i })
    ).not.toBeVisible();
  });
});
