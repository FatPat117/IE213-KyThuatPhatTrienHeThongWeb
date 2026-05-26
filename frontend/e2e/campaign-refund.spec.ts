// frontend/e2e/campaign-refund.spec.ts
// Critical E2E coverage only: refund happy path visibility + non-eligible guard.

import { expect, test } from "@playwright/test";
import { mockCriticalBackendApis } from "./helpers/api";
import { mockJsonRpc, TEST_CAMPAIGN_ONCHAIN_ID } from "./helpers/rpc";
import { connectMockWallet, TEST_ACCOUNTS } from "./helpers/wallet";

const CAMPAIGN_URL = `/campaigns/${TEST_CAMPAIGN_ONCHAIN_ID}`;

async function connectWalletFromHeader(page: import("@playwright/test").Page) {
    const connectButton = page
        .getByRole("button", { name: /Kết nối ví|Ký xác thực ví/i })
        .first();
    if (await connectButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await expect(connectButton).toBeEnabled();
        await connectButton.click();
    }
}

test.describe("Critical refund flow", () => {
    test("donor đủ điều kiện thấy và gửi được yêu cầu hoàn tiền", async ({
        page,
    }) => {
        await connectMockWallet(page, TEST_ACCOUNTS.donorA);
        await mockCriticalBackendApis(page, {
            campaignStatus: "partial_failed",
            refundStatus: "eligible",
            donorHasDonation: true,
        });
        await mockJsonRpc(page, {
            campaignStatus: "partial_failed",
            donorHasDonation: true,
        });

        await page.goto(CAMPAIGN_URL);
        await expect(
            page.getByRole("heading", { name: "Chi tiết chiến dịch" }),
        ).toBeVisible({ timeout: 20_000 });
        await connectWalletFromHeader(page);

        const refundPanel = page.getByText("Chiến dịch không đạt mục tiêu");
        await expect(refundPanel).toBeVisible({ timeout: 20_000 });

        const refundButton = page.getByRole("button", {
            name: /Yêu cầu hoàn tiền/i,
        });
        await expect(refundButton).toBeVisible();
        await expect(refundButton).toBeEnabled();

        await refundButton.click();

        await expect(
            page.getByText("Bạn đã rút tiền hoàn lại thành công", {
                exact: true,
            }),
        ).toBeVisible({ timeout: 15_000 });
    });

    test("không hiển thị refund khi user không có khoản quyên góp", async ({
        page,
    }) => {
        await connectMockWallet(page, TEST_ACCOUNTS.donorB);
        await mockCriticalBackendApis(page, {
            campaignStatus: "partial_failed",
            refundStatus: "none",
            donorHasDonation: false,
        });
        await mockJsonRpc(page, {
            campaignStatus: "partial_failed",
            donorHasDonation: false,
        });

        await page.goto(CAMPAIGN_URL);
        await expect(
            page.getByRole("heading", { name: "Chi tiết chiến dịch" }),
        ).toBeVisible({ timeout: 20_000 });
        await connectWalletFromHeader(page);

        await expect(
            page.getByText("Chiến dịch không đạt mục tiêu"),
        ).not.toBeVisible();
        await expect(
            page.getByRole("button", { name: /Yêu cầu hoàn tiền/i }),
        ).not.toBeVisible();
    });
});
