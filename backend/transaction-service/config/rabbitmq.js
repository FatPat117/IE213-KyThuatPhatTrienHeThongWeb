const amqp = require("amqplib");
const Transaction = require("../models/transaction.model");

const RABBITMQ_URL = process.env.RABBITMQ_URL;
const EXCHANGE = process.env.RABBITMQ_EXCHANGE || "funding.events";
const QUEUE = process.env.RABBITMQ_QUEUE_TX_DONATED || "transaction.donation.queue";
const ROUTING_KEY = process.env.RABBITMQ_RKEY_DONATED || "donation.received";

let channel = null;

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
                        content
                    );

                    await handleDonationEvent(msg.fields.routingKey, content);
                    channel.ack(msg);
                } catch (error) {
                    console.error("[transaction-service] Failed to process message:", error);
                    channel.nack(msg, false, false);
                }
            },
            { noAck: false }
        );
    } catch (error) {
        console.error("[transaction-service] Failed to connect to RabbitMQ:", error.message);
        setTimeout(connectRabbitMQ, 5000);
    }
}

async function handleDonationEvent(routingKey, content) {
    if (routingKey !== ROUTING_KEY) {
        return;
    }

    const { txHash, donorWallet, campaignOnChainId } = content;

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
        console.log(`[transaction-service] Transaction ${txHash} already exists. Skipping duplicate event.`);
        return;
    }

    const newTransaction = new Transaction({
        txHash,
        walletAddress: donorWallet.toLowerCase(),
        action: "donate",
        status: "success",
        campaignOnChainId: Number(campaignOnChainId),
    });

    await newTransaction.save();
    console.log(`[transaction-service] Stored transaction ${txHash} successfully.`);
}

module.exports = { connectRabbitMQ };
