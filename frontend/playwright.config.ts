// frontend/playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E config cho dự án Crowdfunding.
 *
 * Lưu ý quan trọng về ví Gnosis Safe:
 * - Trong môi trường E2E, Reviewer Safe được giả lập bởi một EOA (Externally Owned Account)
 *   thông thường bằng cách inject private key qua biến môi trường.
 * - Frontend sử dụng Anvil local blockchain để tránh phụ thuộc vào mainnet/testnet.
 * - Playwright không tương tác trực tiếp với MetaMask mà sử dụng
 *   wagmi's mock connector hoặc intercept API calls.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,     // Chạy tuần tự để tránh xung đột trạng thái DB
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,               // 1 worker để test blockchain state không bị race condition
  reporter: [
    ['html', { open: 'never' }],
    ['list'],
  ],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // Giả lập viewport màn hình desktop tiêu chuẩn
    viewport: { width: 1280, height: 720 },
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Tự động khởi động Next.js dev server khi chạy locally
  webServer: process.env.CI
    ? undefined
    : {
        command: 'npm run dev',
        url: 'http://localhost:3000',
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
