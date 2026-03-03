const amqplib = require("amqplib");

const EXCHANGE = "ie213.events";
const EXCHANGE_TYPE = "topic";
let channel = null;

async function connectRabbitMQ() {
    const url = process.env.RABBITMQ_URL;
    if (!url) {
        console.warn("[certificate-service] RABBITMQ_URL chưa cấu hình – bỏ qua RabbitMQ");
        return null;
    }
    try {
        const conn = await amqplib.connect(url);
        channel = await conn.createChannel();
        await channel.assertExchange(EXCHANGE, EXCHANGE_TYPE, { durable: true });
        console.log("[certificate-service] RabbitMQ connected");
        conn.on("error", () => { channel = null; });
        conn.on("close", () => { channel = null; });
        return channel;
    } catch (err) {
        console.error("[certificate-service] RabbitMQ connect failed:", err.message);
        return null;
    }
}

function getChannel() { return channel; }

module.exports = { connectRabbitMQ, getChannel, EXCHANGE };
