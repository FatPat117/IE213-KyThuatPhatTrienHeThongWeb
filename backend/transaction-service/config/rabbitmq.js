const amqp = require("amqplib");
const Transaction = require("../models/transaction.model");

const RABBITMQ_URL = process.env.RABBITMQ_URL;
const EXCHANGE = process.env.RABBITMQ_EXCHANGE || "funding.events";
const QUEUE =
    process.env.RABBITMQ_QUEUE_TX_DONATED || "transaction.donation.queue";
const ROUTING_KEY = process.env.RABBITMQ_RKEY_DONATED || "donation.received";
const CAMPAIGN_SERVICE_URL =
    process.env.CAMPAIGN_SERVICE_URL || "http://campaign-service:4002";

let channel = null;

// Hỗ trợ lấy title của campaign từ campaign-service nếu payload không có hoặc có nhưng rỗng
async function resolveCampaignTitle(campaignOnChainId, payloadTitle) {
    const normalizedPayloadTitle =
        typeof payloadTitle === "string" ? payloadTitle.trim() : "";

    if (normalizedPayloadTitle) {
        return normalizedPayloadTitle;
    }

    const normalizedCampaignId = Number(campaignOnChainId);
    if (!Number.isFinite(normalizedCampaignId)) {
        return "";
    }

    try {
        const response = await fetch(
            `${CAMPAIGN_SERVICE_URL}/api/campaigns/${normalizedCampaignId}`,
        );

        if (!response.ok) {
            return "";
        }

        const payload = await response.json();
        return typeof payload?.data?.title === "string"
            ? payload.data.title.trim()
            : "";
    } catch (error) {
        console.warn(
            `[transaction-service] Could not resolve campaign title for campaignOnChainId=${normalizedCampaignId}:`,
            error.message,
        );
        return "";
    }
}

async function connectRabbitMQ() {
    try {
        const connection = await amqp.connect(RABBITMQ_URL);
        channel = await connection.createChannel();
        console.log("[transaction-service] Connected to RabbitMQ");

        await channel.assertExchange(EXCHANGE, "topic", { durable: true });

        const queue = await channel.assertQueue(QUEUE, { durable: true });
        await channel.bindQueue(queue.queue, EXCHANGE, ROUTING_KEY);

        console.log(`[transaction-service] Listening on queue: ${queue.queue}`);

        channel.consume(
            queue.queue,
            async (msg) => {
                if (!msg) return;

                try {
                    const content = JSON.parse(msg.content.toString());
                    console.log(
                        `[transaction-service] Received message from ${msg.fields.routingKey}:`,
                        content,
                    );

                    await handleDonationEvent(msg.fields.routingKey, content);
                    channel.ack(msg);
                } catch (error) {
                    console.error(
                        "[transaction-service] Failed to process message:",
                        error,
                    );
                    channel.nack(msg, false, false);
                }
            },
            { noAck: false },
        );
    } catch (error) {
        console.error(
            "[transaction-service] Failed to connect to RabbitMQ:",
            error.message,
        );
        setTimeout(connectRabbitMQ, 5000);
    }
}

async function handleDonationEvent(routingKey, content) {
    if (routingKey !== ROUTING_KEY) {
        return;
    }

    const { txHash, donorWallet, campaignOnChainId, campaignTitle } = content;

    if (!txHash) {
        throw new Error("Missing txHash in donation payload");
    }

    if (!donorWallet) {
        throw new Error("Missing donorWallet in donation payload");
    }

    if (campaignOnChainId === undefined || campaignOnChainId === null) {
        throw new Error("Missing campaignOnChainId in donation payload");
    }

    const existingTransaction = await Transaction.findOne({ txHash });
    if (existingTransaction) {
        console.log(
            `[transaction-service] Transaction ${txHash} already exists. Skipping duplicate event.`,
        );
        return;
    }

    const resolvedCampaignTitle = await resolveCampaignTitle(
        campaignOnChainId,
        campaignTitle,
    );

    const newTransaction = new Transaction({
        txHash,
        walletAddress: donorWallet.toLowerCase(),
        action: "donate",
        status: "success",
        campaignOnChainId: Number(campaignOnChainId),
        campaignTitle: resolvedCampaignTitle,
    });

    await newTransaction.save();
    console.log(
        `[transaction-service] Stored transaction ${txHash} successfully.`,
    );
}

module.exports = { connectRabbitMQ };
