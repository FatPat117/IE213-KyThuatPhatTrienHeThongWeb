// frontend/e2e/critical-smoke.spec.ts
// Minimal smoke coverage for app routing and campaign read path.

import { expect, test } from "@playwright/test";
import { mockCriticalBackendApis } from "./helpers/api";
import { mockJsonRpc, TEST_CAMPAIGN_ONCHAIN_ID } from "./helpers/rpc";

test.describe("Critical campaign smoke", () => {
    test("campaign list loads indexed campaigns", async ({ page }) => {
        await mockCriticalBackendApis(page, {
            campaignStatus: "active",
            campaignTitle: "E2E Critical Campaign",
        });
        await mockJsonRpc(page, { campaignStatus: "active" });

        await page.goto("/campaigns");

        await expect(
            page.getByRole("heading", { name: /Tất cả chiến dịch/i }),
        ).toBeVisible({ timeout: 20_000 });
        await expect(
            page.getByText("E2E Critical Campaign").first(),
        ).toBeVisible();
        await expect(page.getByText(/Tìm thấy 1 chiến dịch/i)).toBeVisible();
    });

    test("campaign detail merges on-chain data with backend metadata", async ({
        page,
    }) => {
        await mockCriticalBackendApis(page, {
            campaignStatus: "active",
            campaignTitle: "E2E Critical Campaign",
        });
        await mockJsonRpc(page, { campaignStatus: "active" });

        await page.goto(`/campaigns/${TEST_CAMPAIGN_ONCHAIN_ID}`);

        await expect(
            page.getByRole("heading", { name: "Chi tiết chiến dịch" }),
        ).toBeVisible({ timeout: 20_000 });
        await expect(
            page.getByText("E2E Critical Campaign").first(),
        ).toBeVisible();
        await expect(
            page.getByRole("heading", { name: "Lịch sử quyên góp" }),
        ).toBeVisible();
    });
});
