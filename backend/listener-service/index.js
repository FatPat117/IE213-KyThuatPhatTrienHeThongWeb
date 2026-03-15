require("dotenv").config();
const { connectRabbitMQ } = require("./config/rabbitmq");
const { createContractInstance } = require("./config/contract");
const {
    publishCampaignCreated,
} = require("./publishers/campaignCreated.publisher");
const { publishDonated } = require("./publishers/donated.publisher");
const {
    publishCertificateMinted,
} = require("./publishers/certificateMinted.publisher");
const {
    publishFundsWithdrawn,
} = require("./publishers/fundsWithdrawn.publisher");
const {
    publishCampaignCancelled,
} = require("./publishers/campaignCancelled.publisher");
const { startMarkFailedDailyJob } = require("./jobs/markFailed.job");

function toNumberOrNull(value) {
    if (value === undefined || value === null || value === "") return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

async function buildTxContext(event, provider) {
    const txHash = event?.log?.transactionHash || null;
    const blockNumber = toNumberOrNull(event?.log?.blockNumber);
    const logIndex = toNumberOrNull(event?.log?.index ?? event?.log?.logIndex);
    const transactionIndex = toNumberOrNull(event?.log?.transactionIndex);

    const baseContext = {
        txHash,
        blockNumber,
        logIndex,
        transactionIndex,
    };

    if (!provider || !txHash) {
        return baseContext;
    }

    try {
        const [txReceipt, tx, block] = await Promise.all([
            provider.getTransactionReceipt(txHash),
            provider.getTransaction(txHash),
            blockNumber !== null
                ? provider.getBlock(blockNumber)
                : Promise.resolve(null),
        ]);

        const gasUsed = txReceipt?.gasUsed ?? null;
        const effectiveGasPrice =
            txReceipt?.gasPrice ??
            txReceipt?.effectiveGasPrice ??
            tx?.gasPrice ??
            null;
        const gasFeeWei =
            gasUsed && effectiveGasPrice
                ? (gasUsed * effectiveGasPrice).toString()
                : null;

        return {
            ...baseContext,
            chainId: toNumberOrNull(tx?.chainId),
            nonce: toNumberOrNull(tx?.nonce),
            fromAddress: tx?.from ? String(tx.from).toLowerCase() : null,
            toAddress: tx?.to ? String(tx.to).toLowerCase() : null,
            gasUsed: gasUsed ? gasUsed.toString() : null,
            effectiveGasPrice: effectiveGasPrice
                ? effectiveGasPrice.toString()
                : null,
            gasFeeWei,
            txType: toNumberOrNull(tx?.type),
            blockTimestamp:
                block?.timestamp !== undefined
                    ? new Date(Number(block.timestamp) * 1000).toISOString()
                    : null,
        };
    } catch (err) {
        console.warn(
            `[listener-service] Failed to enrich tx context for txHash=${txHash}: ${err.message}`,
        );
        return baseContext;
    }
}

async function startListener() {
    await connectRabbitMQ();
    startMarkFailedDailyJob();

    const result = createContractInstance();

    if (!result) {
        console.warn(
            "[listener-service] Contract is not configured. Listener is running in standby mode.\n" +
                "  Set SEPOLIA_RPC_URL and CROWDFUNDING_CONTRACT_ADDRESS in .env to activate contract events.",
        );
        return;
    }

    const { contract } = result;
    console.log(
        "[listener-service] Contract listener is ready and now subscribing to events.",
    );
    const provider = contract.runner.provider;

    // ── Event: CampaignCreated ────────────────────────────────
    contract.on(
        "CampaignCreated",
        async (id, creator, beneficiary, goal, deadline, event) => {
            console.log(
                `[listener-service] Event CampaignCreated: campaignId=${id}`,
            );
            const txContext = await buildTxContext(event, provider);
            await publishCampaignCreated({
                campaignId: id,
                creator,
                beneficiary,
                goal,
                deadline,
                txHash: txContext.txHash,
                txContext,
            });
        },
    );

    // ── Event: Donated ────────────────────────────────────────
    contract.on("Donated", async (campaignId, donor, amount, event) => {
        const txContext = await buildTxContext(event, provider);
        console.log(
            `[listener-service] Event Donated: txHash=${txContext.txHash}`,
        );
        await publishDonated({
            campaignId,
            donor,
            amount,
            txHash: txContext.txHash,
            txContext,
        });
    });

    // ── Event: CertificateMinted ──────────────────────────────
    contract.on(
        "CertificateMinted",
        async (campaignId, owner, tokenId, event) => {
            console.log(
                `[listener-service] Event CertificateMinted: tokenId=${tokenId}`,
            );
            const txContext = await buildTxContext(event, provider);
            await publishCertificateMinted({
                tokenId,
                campaignId,
                owner,
                txHash: txContext.txHash,
                txContext,
            });
        },
    );

    // ── Event: FundsWithdrawn ─────────────────────────────────
    contract.on(
        "FundsWithdrawn",
        async (campaignId, beneficiary, amount, event) => {
            console.log(
                `[listener-service] Event FundsWithdrawn: campaignId=${campaignId}`,
            );
            const txContext = await buildTxContext(event, provider);
            await publishFundsWithdrawn({
                campaignId,
                beneficiary,
                amount,
                txHash: txContext.txHash,
                txContext,
            });
        },
    );

    // ── Event: CampaignCancelled ──────────────────────────────
    contract.on("CampaignCancelled", async (campaignId, cancelledBy, event) => {
        console.log(
            `[listener-service] Event CampaignCancelled: campaignId=${campaignId}`,
        );
        const txContext = await buildTxContext(event, provider);
        await publishCampaignCancelled({
            campaignId,
            cancelledBy,
            txHash: txContext.txHash,
            txContext,
        });
    });

    // Handle provider-level errors.
    provider.on("error", (err) => {
        console.error("[listener-service] Provider error:", err.message);
    });
}

startListener().catch((err) => {
    console.error("[listener-service] Startup failed:", err.message);
    process.exit(1);
});

process.on("unhandledRejection", (err) => {
    console.error("[listener-service] Unhandled rejection:", err);
});
