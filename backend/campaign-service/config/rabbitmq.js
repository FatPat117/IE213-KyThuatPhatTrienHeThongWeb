const amqplib = require("amqplib");

const EXCHANGE = process.env.RABBITMQ_EXCHANGE || "funding.events";
const EXCHANGE_TYPE = "topic";
let channel = null;
let connection = null;
let connectingPromise = null;

const RETRY_DELAY_MS = Number(process.env.RABBITMQ_RETRY_DELAY_MS || 3000);

function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function connectRabbitMQ() {
    if (channel) {
        return channel;
    }
    if (connectingPromise) {
        return connectingPromise;
    }

    const url = process.env.RABBITMQ_URL;
    if (!url) {
        console.warn("[campaign-service] RABBITMQ_URL chưa cấu hình – bỏ qua RabbitMQ");
        return null;
    }

    connectingPromise = (async () => {
        let attempt = 0;
        while (!channel) {
            attempt += 1;
            try {
                connection = await amqplib.connect(url);
                channel = await connection.createChannel();
                await channel.assertExchange(EXCHANGE, EXCHANGE_TYPE, {
                    durable: true,
                });
                console.log(
                    `[campaign-service] RabbitMQ connected, exchange: ${EXCHANGE} (attempt ${attempt})`,
                );

                connection.on("error", (err) => {
                    console.error(
                        "[campaign-service] RabbitMQ connection error:",
                        err.message,
                    );
                    channel = null;
                });
                connection.on("close", () => {
                    console.warn("[campaign-service] RabbitMQ connection closed");
                    channel = null;
                });

                return channel;
            } catch (err) {
                console.error(
                    `[campaign-service] RabbitMQ connect failed (attempt ${attempt}): ${err.message}. Retrying in ${RETRY_DELAY_MS}ms...`,
                );
                await wait(RETRY_DELAY_MS);
            }
        }

        return channel;
    })();

    try {
        return await connectingPromise;
    } finally {
        connectingPromise = null;
    }
}

function getChannel() {
    return channel;
}

module.exports = { connectRabbitMQ, getChannel, EXCHANGE };
