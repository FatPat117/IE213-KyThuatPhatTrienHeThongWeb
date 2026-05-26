// frontend/e2e/helpers/api.ts
// Helper functions để seed/clean test data và mock backend APIs trong E2E tests.

import { APIRequestContext, Page } from "@playwright/test";
import { TEST_ACCOUNTS } from "./wallet";
import { MockCampaignStatus, TEST_CAMPAIGN_ONCHAIN_ID } from "./rpc";

declare const process: { env: Record<string, string | undefined> };

const BACKEND_URL = process.env.BACKEND_API_URL || "http://localhost:4000";
const ONE_ETH_WEI = "1000000000000000000";
const FIRST_MILESTONE_DISBURSED_WEI = "300000000000000000";
const REMAINING_REFUND_WEI = "700000000000000000";

export type MockRefundStatus = "none" | "eligible" | "prepared" | "refunded";

type MockCriticalApiOptions = {
    campaignStatus?: MockCampaignStatus;
    refundStatus?: MockRefundStatus;
    donorHasDonation?: boolean;
    campaignTitle?: string;
    goalWei?: string;
    totalRaisedWei?: string;
};

function isoDate(offsetMs: number) {
    return new Date(Date.now() + offsetMs).toISOString();
}

function readJsonBody<T extends Record<string, unknown>>(
    rawBody: string | null,
): T {
    if (!rawBody) return {} as T;
    try {
        return JSON.parse(rawBody) as T;
    } catch {
        return {} as T;
    }
}

function createCampaignRecord(options: Required<MockCriticalApiOptions>) {
    return {
        onChainId: TEST_CAMPAIGN_ONCHAIN_ID,
        title: options.campaignTitle,
        description: "Chiến dịch E2E kiểm thử các luồng quan trọng.",
        images: [],
        thumbnailUrl: "",
        creator: TEST_ACCOUNTS.creator.toLowerCase(),
        beneficiary: TEST_ACCOUNTS.creator.toLowerCase(),
        reviewerSafe: TEST_ACCOUNTS.reviewer.toLowerCase(),
        goal: options.goalWei,
        raised: options.totalRaisedWei,
        goalWei: options.goalWei,
        totalRaisedWei: options.totalRaisedWei,
        totalDisbursedWei:
            options.campaignStatus === "partial_failed" ||
            options.campaignStatus === "in_progress"
                ? FIRST_MILESTONE_DISBURSED_WEI
                : "0",
        remainingWei:
            options.campaignStatus === "partial_failed"
                ? REMAINING_REFUND_WEI
                : (
                      BigInt(options.goalWei) - BigInt(options.totalRaisedWei)
                  ).toString(),
        deadline: isoDate(86_400_000),
        status: options.campaignStatus,
        milestoneCount: 2,
        currentMilestoneId: options.campaignStatus === "partial_failed" ? 1 : 0,
        milestones: [
            {
                milestoneId: 0,
                milestoneIndex: 0,
                title: "Mốc 1 - Khởi động",
                description: "Hoàn tất bước khởi động dự án.",
                allocationBps: 3000,
                financialTargetWei: FIRST_MILESTONE_DISBURSED_WEI,
                deadline: isoDate(86_400_000),
                status:
                    options.campaignStatus === "partial_failed"
                        ? "failed"
                        : "pending_verification",
                reportCids: [
                    {
                        cid: "bafybeie2eproofcid",
                        submittedAt: isoDate(-3_600_000),
                    },
                ],
                approvedAt: null,
                approvedBy: "",
                disbursedAt:
                    options.campaignStatus === "active"
                        ? null
                        : isoDate(-3_600_000),
            },
            {
                milestoneId: 1,
                milestoneIndex: 1,
                title: "Mốc 2 - Hoàn thiện",
                description: "Hoàn tất và bàn giao.",
                allocationBps: 7000,
                financialTargetWei: REMAINING_REFUND_WEI,
                deadline: isoDate(172_800_000),
                status: "pending_funding",
                reportCids: [],
                approvedAt: null,
                approvedBy: "",
                disbursedAt: null,
            },
        ],
        rejectionReason: null,
        rejectedAt: null,
        createdAt: isoDate(-86_400_000),
        updatedAt: isoDate(-3_600_000),
    };
}

function createDonationRecord(donorHasDonation: boolean) {
    if (!donorHasDonation) return [];
    return [
        {
            txHash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
            campaignOnChainId: TEST_CAMPAIGN_ONCHAIN_ID,
            donorWallet: TEST_ACCOUNTS.donorA.toLowerCase(),
            amount: ONE_ETH_WEI,
            amountEth: 1,
            message: "Ủng hộ E2E",
            donatedAt: isoDate(-7_200_000),
        },
    ];
}

function success(data: unknown) {
    return JSON.stringify({ success: true, data });
}

function notFound(message = "Not found") {
    return JSON.stringify({ success: false, error: message });
}

export async function mockCriticalBackendApis(
    page: Page,
    options: MockCriticalApiOptions = {},
) {
    const resolved: Required<MockCriticalApiOptions> = {
        campaignStatus: options.campaignStatus ?? "active",
        refundStatus: options.refundStatus ?? "none",
        donorHasDonation: options.donorHasDonation ?? true,
        campaignTitle: options.campaignTitle ?? "E2E Critical Campaign",
        goalWei: options.goalWei ?? ONE_ETH_WEI,
        totalRaisedWei: options.totalRaisedWei ?? ONE_ETH_WEI,
    };
    const campaign = createCampaignRecord(resolved);
    const donations = createDonationRecord(resolved.donorHasDonation);

    await page.route("**/*", async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        const rawPath = url.pathname;
        const path = rawPath.startsWith("/api/") ? rawPath : `/api${rawPath}`;
        const method = request.method();

        if (url.hostname === "safe-transaction-sepolia.safe.global") {
            if (
                method === "GET" &&
                rawPath.match(/\/api\/v1\/owners\/[^/]+\/safes\/?$/)
            ) {
                return route.fulfill({
                    status: 200,
                    contentType: "application/json",
                    body: JSON.stringify({ safes: [] }),
                });
            }

            if (
                method === "GET" &&
                rawPath.match(/\/api\/v1\/safes\/[^/]+\/?$/)
            ) {
                return route.fulfill({
                    status: 200,
                    contentType: "application/json",
                    body: JSON.stringify({
                        owners: [TEST_ACCOUNTS.reviewer],
                        threshold: 1,
                        nonce: 0,
                    }),
                });
            }

            if (
                method === "GET" &&
                rawPath.includes("/multisig-transactions/")
            ) {
                return route.fulfill({
                    status: 200,
                    contentType: "application/json",
                    body: JSON.stringify({ results: [] }),
                });
            }

            if (
                method === "POST" &&
                rawPath.includes("/multisig-transactions/")
            ) {
                return route.fulfill({
                    status: 201,
                    contentType: "application/json",
                    body: JSON.stringify({ safeTxHash: "0x" + "c".repeat(64) }),
                });
            }

            return route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify({}),
            });
        }

        const isLocalhost = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(
            url.hostname,
        );
        const isBackendEndpoint =
            rawPath.startsWith("/api/") || url.port === "4000";
        const isLocalBackendApi =
            isLocalhost &&
            isBackendEndpoint &&
            [
                "/api/auth",
                "/api/campaigns",
                "/api/donations",
                "/api/transactions",
                "/api/milestones",
                "/api/notifications",
            ].some((prefix) => path.startsWith(prefix));

        if (!isLocalBackendApi) {
            return route.fallback();
        }

        if (method === "POST" && path.endsWith("/api/auth/nonce")) {
            const body = readJsonBody<{ wallet?: string }>(request.postData());
            const wallet = body.wallet || TEST_ACCOUNTS.donorA;
            return route.fulfill({
                status: 200,
                contentType: "application/json",
                body: success({
                    nonce: "e2e-nonce",
                    wallet,
                }),
            });
        }

        if (method === "POST" && path.endsWith("/api/auth/verify")) {
            const body = readJsonBody<{ wallet?: string }>(request.postData());
            const wallet = body.wallet || TEST_ACCOUNTS.donorA;
            return route.fulfill({
                status: 200,
                contentType: "application/json",
                body: success({
                    token: "e2e-token",
                    user: {
                        wallet,
                        role: "user",
                        displayName: "E2E Donor",
                    },
                }),
            });
        }

        if (method === "GET" && path.includes("/api/notifications/stream")) {
            return route.fulfill({
                status: 200,
                contentType: "text/event-stream",
                body: "event: connected\ndata: {}\n\n",
                headers: {
                    "Cache-Control": "no-cache",
                    Connection: "keep-alive",
                },
            });
        }

        if (method === "GET" && path.includes("/api/notifications/me")) {
            return route.fulfill({
                status: 200,
                contentType: "application/json",
                body: success([]),
            });
        }

        if (
            method === "PATCH" &&
            path.endsWith("/api/notifications/read-all")
        ) {
            return route.fulfill({
                status: 200,
                contentType: "application/json",
                body: success(true),
            });
        }

        if (
            method === "PATCH" &&
            path.includes("/api/notifications/") &&
            path.endsWith("/read")
        ) {
            return route.fulfill({
                status: 200,
                contentType: "application/json",
                body: success({
                    _id: "e2e-notification",
                    recipientWallet: TEST_ACCOUNTS.creator.toLowerCase(),
                    type: "campaign_created",
                    title: "E2E notification",
                    message: "Mock notification",
                    campaignOnChainId: TEST_CAMPAIGN_ONCHAIN_ID,
                    txHash: "",
                    read: true,
                    createdAt: isoDate(0),
                }),
            });
        }

        if (
            method === "GET" &&
            path.endsWith("/api/campaigns/reviewers/admin/profiles")
        ) {
            return route.fulfill({
                status: 200,
                contentType: "application/json",
                body: success([
                    {
                        reviewerCode: "E2E-REVIEWER",
                        walletAddress: TEST_ACCOUNTS.reviewer.toLowerCase(),
                        organizationName: "E2E Reviewer Org",
                        region: "E2E Region",
                        isActive: true,
                        createdAt: isoDate(-86_400_000),
                        updatedAt: isoDate(-3_600_000),
                    },
                ]),
            });
        }

        if (
            method === "GET" &&
            path.endsWith(`/api/campaigns/${TEST_CAMPAIGN_ONCHAIN_ID}`)
        ) {
            return route.fulfill({
                status: 200,
                contentType: "application/json",
                body: success(campaign),
            });
        }

        if (
            method === "GET" &&
            path.endsWith(`/api/campaigns/${TEST_CAMPAIGN_ONCHAIN_ID}/status`)
        ) {
            return route.fulfill({
                status: 200,
                contentType: "application/json",
                body: success({ indexed: true }),
            });
        }

        if (
            method === "PUT" &&
            path.endsWith(`/api/campaigns/${TEST_CAMPAIGN_ONCHAIN_ID}/metadata`)
        ) {
            const body = readJsonBody<{
                title?: string;
                description?: string;
                thumbnailUrl?: string;
                reviewerSafe?: string;
                beneficiary?: string;
                milestones?: Array<{
                    milestoneId: number;
                    title?: string;
                    description?: string;
                }>;
            }>(request.postData());
            const updatedCampaign = {
                ...campaign,
                title: body.title || campaign.title,
                description: body.description || campaign.description,
                thumbnailUrl: body.thumbnailUrl || campaign.thumbnailUrl,
                reviewerSafe: body.reviewerSafe || campaign.reviewerSafe,
                beneficiary: body.beneficiary || campaign.beneficiary,
                milestones: campaign.milestones.map((milestone, index) => ({
                    ...milestone,
                    title: body.milestones?.[index]?.title || milestone.title,
                    description:
                        body.milestones?.[index]?.description ||
                        milestone.description,
                })),
                updatedAt: isoDate(0),
            };
            return route.fulfill({
                status: 200,
                contentType: "application/json",
                body: success(updatedCampaign),
            });
        }

        if (method === "GET" && path.endsWith("/api/campaigns")) {
            return route.fulfill({
                status: 200,
                contentType: "application/json",
                body: success({
                    campaigns: [campaign],
                    pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
                }),
            });
        }

        if (
            method === "GET" &&
            path.endsWith("/api/campaigns/public/campaigns")
        ) {
            return route.fulfill({
                status: 200,
                contentType: "application/json",
                body: success({
                    items: [campaign],
                    pagination: {
                        page: 1,
                        limit: 100,
                        totalItems: 1,
                        totalPages: 1,
                    },
                }),
            });
        }

        if (method === "GET" && path.endsWith("/api/campaigns/public/stats")) {
            return route.fulfill({
                status: 200,
                contentType: "application/json",
                body: success({
                    totalCampaigns: 1,
                    activeCampaigns:
                        resolved.campaignStatus === "active" ? 1 : 0,
                    inProgressCampaigns:
                        resolved.campaignStatus === "in_progress" ? 1 : 0,
                    completedCampaigns:
                        resolved.campaignStatus === "completed" ? 1 : 0,
                    partialFailedCampaigns:
                        resolved.campaignStatus === "partial_failed" ? 1 : 0,
                    failedCampaigns:
                        resolved.campaignStatus === "failed" ? 1 : 0,
                    totalRaisedWei: ONE_ETH_WEI,
                    totalDisbursedWei: campaign.totalDisbursedWei,
                    uniqueDonors: resolved.donorHasDonation ? 1 : 0,
                    totalCertificates: 0,
                    updatedAt: isoDate(0),
                }),
            });
        }

        if (
            method === "GET" &&
            path.endsWith(
                `/api/campaigns/public/campaigns/${TEST_CAMPAIGN_ONCHAIN_ID}`,
            )
        ) {
            return route.fulfill({
                status: 200,
                contentType: "application/json",
                body: success(campaign),
            });
        }

        if (
            method === "GET" &&
            path.endsWith(
                `/api/campaigns/public/campaigns/${TEST_CAMPAIGN_ONCHAIN_ID}/milestones`,
            )
        ) {
            return route.fulfill({
                status: 200,
                contentType: "application/json",
                body: success({
                    campaignOnChainId: TEST_CAMPAIGN_ONCHAIN_ID,
                    milestones: campaign.milestones,
                }),
            });
        }

        if (
            method === "GET" &&
            path.endsWith(
                `/api/campaigns/public/campaigns/${TEST_CAMPAIGN_ONCHAIN_ID}/refund-status`,
            )
        ) {
            const isRefunded = resolved.refundStatus === "refunded";
            const isEligible = resolved.refundStatus !== "none";
            return route.fulfill({
                status: 200,
                contentType: "application/json",
                body: success({
                    success: true,
                    data: {
                        status: resolved.refundStatus,
                        eligibleRefundWei: isEligible
                            ? REMAINING_REFUND_WEI
                            : "0",
                        refundedWei: isRefunded ? REMAINING_REFUND_WEI : "0",
                        refundedAt: isRefunded ? isoDate(-60_000) : null,
                    },
                }),
            });
        }

        if (
            method === "GET" &&
            path.endsWith(`/api/donations/campaign/${TEST_CAMPAIGN_ONCHAIN_ID}`)
        ) {
            return route.fulfill({
                status: 200,
                contentType: "application/json",
                body: success(donations),
            });
        }

        if (
            method === "GET" &&
            path.includes(
                `/api/donations/campaign/${TEST_CAMPAIGN_ONCHAIN_ID}/donor/`,
            )
        ) {
            return route.fulfill({
                status: 200,
                contentType: "application/json",
                body: success(donations),
            });
        }

        if (method === "GET" && path.includes("/api/transactions/")) {
            return route.fulfill({
                status: 200,
                contentType: "application/json",
                body: success([]),
            });
        }

        if (method === "POST" && path.endsWith("/api/transactions")) {
            const body = readJsonBody<{
                txHash?: string;
                walletAddress?: string;
                action?: string;
                campaignOnChainId?: number;
            }>(request.postData());
            return route.fulfill({
                status: 201,
                contentType: "application/json",
                body: success({
                    txHash:
                        body.txHash ||
                        "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                    walletAddress:
                        body.walletAddress ||
                        TEST_ACCOUNTS.donorA.toLowerCase(),
                    action: body.action || "donate",
                    status: "pending",
                    campaignOnChainId:
                        body.campaignOnChainId || TEST_CAMPAIGN_ONCHAIN_ID,
                    createdAt: isoDate(0),
                    updatedAt: isoDate(0),
                }),
            });
        }

        return route.fulfill({
            status: 404,
            contentType: "application/json",
            body: notFound(path),
        });
    });
}

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
    },
) {
    const res = await request.post(`${BACKEND_URL}/api/campaigns/test/seed`, {
        data,
        headers: { "x-test-secret": process.env.TEST_SECRET || "test-secret" },
    });
    return res.json();
}

export async function cleanupTestData(
    request: APIRequestContext,
    onChainId: number,
) {
    await request.delete(
        `${BACKEND_URL}/api/campaigns/test/cleanup/${onChainId}`,
        {
            headers: {
                "x-test-secret": process.env.TEST_SECRET || "test-secret",
            },
        },
    );
}
