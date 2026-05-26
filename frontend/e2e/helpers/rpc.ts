// frontend/e2e/helpers/rpc.ts
// Centralized JSON-RPC mocks for critical E2E flows.

import { Page, Route } from "@playwright/test";
import {
    decodeAbiParameters,
    encodeAbiParameters,
    encodeEventTopics,
    parseAbiParameters,
} from "viem";
import { MOCK_TX_HASH, TEST_ACCOUNTS } from "./wallet";

export const TEST_CAMPAIGN_ONCHAIN_ID = 1;
export const TEST_CONTRACT_ADDRESS =
    "0xC6c147727cE6021e2A309d227c5b73346E38CF72" as const;

const ONE_ETH = 1_000_000_000_000_000_000n;
const FIRST_MILESTONE_DISBURSED = 300_000_000_000_000_000n;

const SELECTORS = {
    aggregate3: "0x82ad56cb",
    campaignCount: "0x7274e30d",
    campaignReviewerSafe: "0xeaf94f01",
    createCampaignWithGoal: "0x122aa7a7",
    donate: "0xf14faf6f",
    getCampaign: "0x5598f8cc",
    getDonation: "0xc2bacfa8",
    getReviewerSafes: "0x12254f38",
    hasRole: "0x91d14854",
    hasMintedCertificate: "0xdd0ed604",
    isActiveReviewer: "0x6295e7ee",
    getMilestone: "0x8ed9895c",
    reviewerSafes: "0xd353d4f3",
} as const;

const CAMPAIGN_CREATED_EVENT = {
    type: "event",
    name: "CampaignCreated",
    inputs: [
        { name: "campaignId", type: "uint256", indexed: true },
        { name: "creator", type: "address", indexed: false },
        { name: "beneficiary", type: "address", indexed: false },
        { name: "goal", type: "uint256", indexed: false },
        { name: "fundingDeadline", type: "uint256", indexed: false },
        { name: "milestoneCount", type: "uint256", indexed: false },
    ],
} as const;

export type MockCampaignStatus =
    | "pending_approval"
    | "active"
    | "in_progress"
    | "completed"
    | "partial_failed"
    | "failed"
    | "cancelled";

export type MockRpcOptions = {
    campaignStatus?: MockCampaignStatus;
    donorHasDonation?: boolean;
    hasMintedCertificate?: boolean;
    txHash?: string;
    goalWei?: bigint;
    totalRaisedWei?: bigint;
    createdCampaignId?: number;
};

type JsonRpcResponse = {
    jsonrpc: "2.0";
    id: unknown;
    result: unknown;
};

function campaignStatusToEnum(status: MockCampaignStatus) {
    return {
        pending_approval: 0,
        active: 1,
        in_progress: 2,
        completed: 3,
        partial_failed: 4,
        failed: 5,
        cancelled: 6,
    }[status];
}

function milestoneStatusForCampaign(status: MockCampaignStatus) {
    if (status === "partial_failed" || status === "failed") return 4; // Failed
    if (status === "completed") return 3; // Disbursed
    if (status === "in_progress") return 1; // PendingVerification
    return 0; // PendingFunding
}

function encodeUint(value: bigint | number) {
    return encodeAbiParameters(parseAbiParameters("uint256"), [BigInt(value)]);
}

function encodeBool(value: boolean) {
    return encodeAbiParameters(parseAbiParameters("bool"), [value]);
}

function encodeAddress(value: string) {
    return encodeAbiParameters(parseAbiParameters("address"), [
        value as `0x${string}`,
    ]);
}

function encodeAddressArray(values: readonly string[]) {
    return encodeAbiParameters(parseAbiParameters("address[]"), [
        values as readonly `0x${string}`[],
    ]);
}

function encodeCampaign(options: Required<MockRpcOptions>) {
    const status = options.campaignStatus;
    const statusEnum = campaignStatusToEnum(status);
    const totalDisbursed =
        status === "partial_failed" ||
        status === "in_progress" ||
        status === "completed"
            ? FIRST_MILESTONE_DISBURSED
            : 0n;
    const currentMilestoneId =
        status === "partial_failed" || status === "completed" ? 1n : 0n;

    return encodeAbiParameters(
        parseAbiParameters(
            "uint256 id, address creator, address beneficiary, uint256 goal, uint256 totalRaised, uint256 totalDisbursed, uint256 deadline, bool withdrawn, uint8 status, uint256 milestoneCount, uint256 currentMilestoneId",
        ),
        [
            BigInt(TEST_CAMPAIGN_ONCHAIN_ID),
            TEST_ACCOUNTS.creator,
            TEST_ACCOUNTS.creator,
            options.goalWei,
            options.totalRaisedWei,
            totalDisbursed,
            BigInt(Math.floor(Date.now() / 1000) + 86_400),
            false,
            statusEnum,
            2n,
            currentMilestoneId,
        ],
    );
}

function encodeCampaignCreatedLog(options: Required<MockRpcOptions>) {
    const campaignId = BigInt(options.createdCampaignId);
    return {
        address: TEST_CONTRACT_ADDRESS,
        topics: encodeEventTopics({
            abi: [CAMPAIGN_CREATED_EVENT],
            eventName: "CampaignCreated",
            args: { campaignId },
        }),
        data: encodeAbiParameters(
            parseAbiParameters(
                "address creator, address beneficiary, uint256 goal, uint256 fundingDeadline, uint256 milestoneCount",
            ),
            [
                TEST_ACCOUNTS.creator,
                TEST_ACCOUNTS.creator,
                options.goalWei,
                BigInt(Math.floor(Date.now() / 1000) + 86_400),
                1n,
            ],
        ),
        blockNumber: "0x500001",
        transactionHash: options.txHash,
        transactionIndex: "0x0",
        blockHash: `0x${"b".repeat(64)}`,
        logIndex: "0x0",
        removed: false,
    };
}

function encodeMilestone(status: MockCampaignStatus) {
    return encodeAbiParameters(
        parseAbiParameters(
            "uint256 id, uint16 allocationBps, uint256 deadline, string[] proofCids, uint256 proofSubmissionCount, uint8 status, address approvedBy, uint256 approvedAt, uint256 disbursedAt, uint256 failedAt",
        ),
        [
            0n,
            3000,
            BigInt(Math.floor(Date.now() / 1000) + 86_400),
            ["bafybeie2eproofcid"],
            1n,
            milestoneStatusForCampaign(status),
            TEST_ACCOUNTS.reviewer,
            0n,
            status === "active"
                ? 0n
                : BigInt(Math.floor(Date.now() / 1000) - 3600),
            status === "partial_failed" || status === "failed"
                ? BigInt(Math.floor(Date.now() / 1000) - 1800)
                : 0n,
        ],
    );
}

function jsonRpcResponse(id: unknown, result: unknown): JsonRpcResponse {
    return { jsonrpc: "2.0", id, result };
}

function encodeContractCallResult(
    data: string,
    options: Required<MockRpcOptions>,
): `0x${string}` {
    const lowered = data.toLowerCase();

    if (lowered.startsWith(SELECTORS.aggregate3)) {
        const encodedArgs = `0x${data.slice(10)}` as `0x${string}`;
        const [calls] = decodeAbiParameters(
            parseAbiParameters(
                "(address target, bool allowFailure, bytes callData)[]",
            ),
            encodedArgs,
        ) as [
            Array<{
                target: string;
                allowFailure: boolean;
                callData: `0x${string}`;
            }>,
        ];
        const results = calls.map((call) => ({
            success: true,
            returnData: encodeContractCallResult(call.callData, options),
        }));

        return encodeAbiParameters(
            parseAbiParameters("(bool success, bytes returnData)[]"),
            [results],
        );
    }

    if (lowered.startsWith(SELECTORS.campaignCount)) {
        return encodeUint(1n);
    }
    if (lowered.startsWith(SELECTORS.getReviewerSafes)) {
        return encodeAddressArray([TEST_ACCOUNTS.reviewer]);
    }
    if (lowered.startsWith(SELECTORS.reviewerSafes)) {
        return encodeBool(true);
    }
    if (lowered.startsWith(SELECTORS.isActiveReviewer)) {
        return encodeBool(true);
    }
    if (lowered.startsWith(SELECTORS.campaignReviewerSafe)) {
        return encodeAddress(TEST_ACCOUNTS.reviewer);
    }
    if (lowered.startsWith(SELECTORS.hasRole)) {
        return encodeBool(true);
    }
    if (lowered.startsWith(SELECTORS.getCampaign)) {
        return encodeCampaign(options);
    }
    if (lowered.startsWith(SELECTORS.getDonation)) {
        return encodeUint(options.donorHasDonation ? ONE_ETH : 0n);
    }
    if (lowered.startsWith(SELECTORS.hasMintedCertificate)) {
        return encodeBool(options.hasMintedCertificate);
    }
    if (lowered.startsWith(SELECTORS.getMilestone)) {
        return encodeMilestone(options.campaignStatus);
    }
    if (lowered.startsWith(SELECTORS.createCampaignWithGoal)) {
        return encodeUint(options.createdCampaignId);
    }
    if (lowered.startsWith(SELECTORS.donate)) {
        return "0x";
    }

    return encodeUint(0n);
}

async function fulfillJson(route: Route, body: unknown) {
    await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(body),
    });
}

function isLikelyJsonRpcUrl(url: string) {
    const lowered = url.toLowerCase();
    return (
        lowered.includes("sepolia") ||
        lowered.includes("rpc") ||
        lowered.includes("alchemy") ||
        lowered.includes("infura") ||
        lowered.includes("publicnode")
    );
}

async function handleRpcPayload(
    payload: any,
    options: Required<MockRpcOptions>,
): Promise<JsonRpcResponse | JsonRpcResponse[]> {
    if (Array.isArray(payload)) {
        const responses = await Promise.all(
            payload.map((item) => handleRpcPayload(item, options)),
        );
        return responses.flat() as JsonRpcResponse[];
    }

    const id = payload?.id ?? 1;
    const method = payload?.method;

    switch (method) {
        case "eth_chainId":
            return jsonRpcResponse(id, "0xaa36a7");
        case "net_version":
            return jsonRpcResponse(id, "11155111");
        case "eth_blockNumber":
            return jsonRpcResponse(id, "0x500000");
        case "eth_getBalance":
            return jsonRpcResponse(id, "0xde0b6b3a7640000");
        case "eth_getCode":
            return jsonRpcResponse(id, "0x6080604052");
        case "eth_gasPrice":
            return jsonRpcResponse(id, "0x3b9aca00");
        case "eth_maxPriorityFeePerGas":
            return jsonRpcResponse(id, "0x3b9aca00");
        case "eth_feeHistory":
            return jsonRpcResponse(id, {
                oldestBlock: "0x4ffffb",
                baseFeePerGas: ["0x3b9aca00", "0x3b9aca00", "0x3b9aca00"],
                gasUsedRatio: [0.2, 0.3],
                reward: [["0x3b9aca00"], ["0x3b9aca00"]],
            });
        case "eth_estimateGas":
            return jsonRpcResponse(id, "0x7a120");
        case "eth_sendTransaction":
            return jsonRpcResponse(id, options.txHash);
        case "eth_getTransactionByHash":
            return jsonRpcResponse(id, {
                hash: options.txHash,
                blockNumber: "0x500001",
                from: TEST_ACCOUNTS.donorA,
                to: TEST_ACCOUNTS.creator,
            });
        case "eth_getTransactionReceipt":
            return jsonRpcResponse(id, {
                transactionHash: options.txHash,
                status: "0x1",
                blockNumber: "0x500001",
                blockHash: `0x${"b".repeat(64)}`,
                logs: options.createdCampaignId
                    ? [encodeCampaignCreatedLog(options)]
                    : [],
            });
        case "eth_getLogs":
            return jsonRpcResponse(id, []);
        case "eth_newFilter":
            return jsonRpcResponse(id, "0x1");
        case "eth_getFilterChanges":
            return jsonRpcResponse(id, []);
        case "eth_uninstallFilter":
            return jsonRpcResponse(id, true);
        case "eth_call": {
            const data = String(payload?.params?.[0]?.data || "").toLowerCase();
            return jsonRpcResponse(id, encodeContractCallResult(data, options));
        }
        default:
            return jsonRpcResponse(id, null);
    }
}

export async function mockJsonRpc(page: Page, options: MockRpcOptions = {}) {
    const resolved: Required<MockRpcOptions> = {
        campaignStatus: options.campaignStatus ?? "active",
        donorHasDonation: options.donorHasDonation ?? true,
        hasMintedCertificate: options.hasMintedCertificate ?? false,
        txHash: options.txHash ?? MOCK_TX_HASH,
        goalWei: options.goalWei ?? ONE_ETH,
        totalRaisedWei: options.totalRaisedWei ?? ONE_ETH,
        createdCampaignId: options.createdCampaignId ?? 0,
    };

    await page.route("**", async (route) => {
        const request = route.request();
        if (!["fetch", "xhr"].includes(request.resourceType())) {
            return route.fallback();
        }
        if (request.method() !== "POST" || !isLikelyJsonRpcUrl(request.url())) {
            return route.fallback();
        }

        let payload: unknown;
        try {
            payload = request.postDataJSON();
        } catch {
            return route.fallback();
        }

        if (
            !payload ||
            (Array.isArray(payload)
                ? payload.length === 0
                : !(payload as any).method)
        ) {
            return route.fallback();
        }

        await fulfillJson(route, await handleRpcPayload(payload, resolved));
    });
}
