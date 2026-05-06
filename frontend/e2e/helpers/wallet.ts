// frontend/e2e/helpers/wallet.ts
// Helpers để giả lập kết nối ví trong E2E tests.
//
// CHIẾN LƯỢC VÍ SAFE:
// - Trong E2E test, chúng ta KHÔNG dùng MetaMask thật (không thể tự động hoá).
// - Thay vào đó, chúng ta mock các wagmi hooks ở cấp độ API response.
// - Reviewer Safe được giả lập là một EOA thông thường trong môi trường test.
// - Anvil cung cấp các pre-funded accounts với private keys đã biết trước.
//
// Các địa chỉ test (Anvil default accounts):
export const TEST_ACCOUNTS = {
  // Account 0 - Admin/Creator
  creator: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
  // Account 1 - Donor A  
  donorA: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
  // Account 2 - Donor B
  donorB: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
  // Account 3 - Reviewer (giả lập Safe bằng EOA trong test)
  reviewer: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
} as const;

import { Page } from '@playwright/test';

/**
 * Inject mock wallet state vào localStorage để bypass MetaMask popup.
 * wagmi v2 lưu trạng thái kết nối trong localStorage.
 */
export async function connectMockWallet(page: Page, address: string) {
  await page.addInitScript((walletAddress: string) => {
    // Mock window.ethereum for injected connector
    (window as any).ethereum = {
      isMetaMask: true,
      request: async (request: { method: string, params?: any[] }) => {
        if (request.method === 'eth_requestAccounts' || request.method === 'eth_accounts') {
          return [walletAddress];
        }
        if (request.method === 'eth_chainId') {
          return '0xaa36a7'; // Sepolia (11155111)
        }
        return null;
      },
      on: () => {},
      removeListener: () => {},
      autoRefreshOnNetworkChange: false,
    };

    // Mock wagmi store (v2/v3 style)
    // We use a simple object instead of Map for JSON compatibility
    localStorage.setItem('wagmi.store', JSON.stringify({
      state: {
        connections: {
          'injected': {
            accounts: [walletAddress],
            chainId: 11155111,
            connector: { id: 'injected', name: 'Mock Wallet', type: 'injected' },
          }
        },
        current: 'injected',
        status: 'connected',
      },
    }));
    localStorage.setItem('wagmi.connected', 'true');
    localStorage.setItem('wagmi.recentConnectorId', 'injected');
  }, address);
}

/**
 * Intercept và auto-confirm blockchain transactions bằng cách mock fetch responses.
 * Dùng cho các test cần simulate transaction confirmation.
 */
export async function mockSuccessfulTransaction(page: Page, txHash: string) {
  await page.route('**/api/campaigns/**/refund-status**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          status: 'refunded',
          refundedWei: '700000000000000000',
          eligibleRefundWei: '700000000000000000',
        },
      }),
    });
  });
}
