const amqplib = require("amqplib");

const EXCHANGE = process.env.RABBITMQ_EXCHANGE || "funding.events";
let channel = null;

async function connectRabbitMQ() {
    const url = process.env.RABBITMQ_URL;
    if (!url) {
        console.warn("[listener-service] RABBITMQ_URL chưa cấu hình");
        return null;
    }
    try {
        const conn = await amqplib.connect(url);
        channel = await conn.createChannel();
        await channel.assertExchange(EXCHANGE, "topic", { durable: true });
        console.log("[listener-service] RabbitMQ connected, exchange:", EXCHANGE);
        conn.on("error", () => { channel = null; });
        conn.on("close", () => { channel = null; });
        return channel;
    } catch (err) {
        console.error("[listener-service] RabbitMQ connect failed:", err.message);
        return null;
    }
}

function getChannel() { return channel; }

module.exports = { connectRabbitMQ, getChannel, EXCHANGE };
