// frontend/e2e/campaign-create-donate.spec.ts
// Critical E2E coverage: create campaign -> open created campaign -> donate successfully.

import { expect, test } from "@playwright/test";
import { mockCriticalBackendApis } from "./helpers/api";
import { mockJsonRpc, TEST_CAMPAIGN_ONCHAIN_ID } from "./helpers/rpc";
import { connectMockWallet, TEST_ACCOUNTS } from "./helpers/wallet";

test.setTimeout(60_000);

const CREATED_CAMPAIGN_TITLE = "E2E Created Donation Campaign";
const ONE_ETH_WEI = "1000000000000000000";

function futureDateTimeLocal(daysFromNow: number) {
    const date = new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000);
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    const hh = String(date.getHours()).padStart(2, "0");
    const min = String(date.getMinutes()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

async function fillCampaignDescription(page: import("@playwright/test").Page) {
    await page
        .getByLabel(/Địa điểm & đơn vị/i)
        .fill("Trường E2E tại TP.HCM cần gây quỹ minh bạch.");
    await page
        .getByLabel(/Hoàn cảnh/i)
        .fill(
            "Nhóm học sinh cần thêm thiết bị học tập cơ bản để duy trì lớp học sau giờ.",
        );
    await page
        .getByLabel(/Mục tiêu & kế hoạch/i)
        .fill(
            "Nguồn quỹ sẽ mua thiết bị, bàn ghế và công khai tiến độ theo từng mốc nghiệm thu.",
        );
    await page
        .getByLabel(/Minh bạch/i)
        .fill(
            "Mỗi mốc sẽ có ảnh hiện trường, hóa đơn và biên bản nghiệm thu để cộng đồng kiểm chứng.",
        );
}

test.describe("Critical create-to-donate flow", () => {
    test("tạo campaign rồi donate thành công", async ({ page }) => {
        await connectMockWallet(page, TEST_ACCOUNTS.creator);
        await mockCriticalBackendApis(page, {
            campaignStatus: "active",
            campaignTitle: CREATED_CAMPAIGN_TITLE,
            donorHasDonation: false,
            goalWei: ONE_ETH_WEI,
            totalRaisedWei: "0",
        });
        await mockJsonRpc(page, {
            campaignStatus: "active",
            donorHasDonation: false,
            createdCampaignId: TEST_CAMPAIGN_ONCHAIN_ID,
            goalWei: 1_000_000_000_000_000_000n,
            totalRaisedWei: 0n,
        });

        await page.goto("/campaigns/create");

        await expect(
            page.getByRole("heading", { name: "Tạo chiến dịch" }),
        ).toBeVisible({ timeout: 20_000 });

        await page.getByLabel(/Tên chiến dịch/i).fill(CREATED_CAMPAIGN_TITLE);
        await fillCampaignDescription(page);
        await page.getByLabel(/Mục tiêu gây quỹ/i).fill("1.0");
        await page
            .getByLabel("Chọn thời hạn chiến dịch")
            .fill(futureDateTimeLocal(7));

        const reviewerSelect = page.getByLabel(
            "Chọn kiểm duyệt viên phụ trách",
        );
        await expect(
            page.locator("#campaign-reviewer option", {
                hasText: "E2E Reviewer Org",
            }),
        ).toHaveCount(1, { timeout: 20_000 });
        await reviewerSelect.selectOption(TEST_ACCOUNTS.reviewer.toLowerCase());

        await expect(page.getByLabel(/Địa chỉ ví nhận tiền/i)).toHaveValue(
            TEST_ACCOUNTS.creator.toLowerCase(),
        );

        await page.getByRole("button", { name: /Tạo chiến dịch/i }).click();

        await expect(
            page.getByRole("heading", { name: /Bước thiết lập mốc/i }),
        ).toBeVisible({ timeout: 20_000 });
        await page
            .getByPlaceholder(/Hoàn thiện sản phẩm mẫu/i)
            .fill("Mốc nghiệm thu E2E");
        await page.getByPlaceholder("2.5").fill("1.0");
        await page
            .locator('input[type="datetime-local"]')
            .fill(futureDateTimeLocal(14));
        await page
            .getByPlaceholder(/Mô tả ngắn về hạng mục/i)
            .fill(
                "Hoàn tất mua sắm thiết bị, công khai hóa đơn và nghiệm thu cho cộng đồng.",
            );

        await page.getByRole("button", { name: "Tiếp tục" }).click();

        await expect(page.getByText("Tạo chiến dịch thành công!")).toBeVisible({
            timeout: 20_000,
        });
        await page.waitForURL(`**/campaigns/${TEST_CAMPAIGN_ONCHAIN_ID}`, {
            timeout: 20_000,
        });

        await expect(
            page.getByRole("heading", { name: "Chi tiết chiến dịch" }),
        ).toBeVisible({ timeout: 20_000 });
        await expect(
            page.getByText(CREATED_CAMPAIGN_TITLE).first(),
        ).toBeVisible();

        const donationInput = page.locator('input[placeholder="0.01"]').first();
        await donationInput.fill("0.1");

        const donateButton = page.getByRole("button", {
            name: /^💝 Quyên góp$/,
        });
        await expect(donateButton).toBeEnabled();
        await donateButton.click();

        await expect(
            page.getByText("✓ Quyên góp thành công! Cảm ơn bạn."),
        ).toBeVisible({ timeout: 20_000 });
    });
});
