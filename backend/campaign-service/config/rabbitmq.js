const amqplib = require("amqplib");

const EXCHANGE = process.env.RABBITMQ_EXCHANGE || "funding.events";
const EXCHANGE_TYPE = "topic";
let channel = null;

async function connectRabbitMQ() {
    const url = process.env.RABBITMQ_URL;
    if (!url) {
        console.warn("[campaign-service] RABBITMQ_URL chưa cấu hình – bỏ qua RabbitMQ");
        return null;
    }
    try {
        const conn = await amqplib.connect(url);
        channel = await conn.createChannel();
        await channel.assertExchange(EXCHANGE, EXCHANGE_TYPE, { durable: true });
        console.log("[campaign-service] RabbitMQ connected, exchange:", EXCHANGE);

        // Xử lý mất kết nối
        conn.on("error", (err) => {
            console.error("[campaign-service] RabbitMQ connection error:", err.message);
            channel = null;
        });
        conn.on("close", () => {
            console.warn("[campaign-service] RabbitMQ connection closed");
            channel = null;
        });

        return channel;
    } catch (err) {
        console.error("[campaign-service] RabbitMQ connect failed:", err.message);
        return null;
    }
}

function getChannel() {
    return channel;
}

module.exports = { connectRabbitMQ, getChannel, EXCHANGE };
