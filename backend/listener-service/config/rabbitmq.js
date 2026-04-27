const amqplib = require("amqplib");

const EXCHANGE = process.env.RABBITMQ_EXCHANGE || "funding.events";
let channel = null;
let connection = null;
let connectingPromise = null;
const RETRY_DELAY_MS = Number(process.env.RABBITMQ_RETRY_DELAY_MS || 3000);

function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function connectRabbitMQ() {
    if (channel) return channel;
    if (connectingPromise) return connectingPromise;

    const url = process.env.RABBITMQ_URL;
    if (!url) {
        console.warn("[listener-service] RABBITMQ_URL chưa cấu hình");
        return null;
    }

    connectingPromise = (async () => {
        let attempt = 0;
        while (!channel) {
            attempt += 1;
            try {
                connection = await amqplib.connect(url);
                channel = await connection.createConfirmChannel();
                await channel.assertExchange(EXCHANGE, "topic", { durable: true });
                console.log(
                    `[listener-service] RabbitMQ connected, exchange: ${EXCHANGE} (attempt ${attempt})`,
                );
                connection.on("error", () => {
                    channel = null;
                });
                connection.on("close", () => {
                    channel = null;
                });
                return channel;
            } catch (err) {
                console.error(
                    `[listener-service] RabbitMQ connect failed (attempt ${attempt}): ${err.message}. Retrying in ${RETRY_DELAY_MS}ms...`,
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

async function publishWithRetry(
    routingKey,
    payload,
    options = {
        maxAttempts: Number(process.env.RABBITMQ_PUBLISH_MAX_ATTEMPTS || 0),
        retryDelayMs: RETRY_DELAY_MS,
    },
) {
    const maxAttempts = Number(options.maxAttempts || 0);
    const unlimitedAttempts = maxAttempts <= 0;
    const retryDelayMs = Number(options.retryDelayMs || RETRY_DELAY_MS);
    const body = Buffer.from(JSON.stringify(payload));

    for (let attempt = 1; unlimitedAttempts || attempt <= maxAttempts; attempt += 1) {
        try {
            const readyChannel = (await connectRabbitMQ()) || getChannel();
            if (!readyChannel) {
                throw new Error("RabbitMQ channel unavailable");
            }

            readyChannel.publish(EXCHANGE, routingKey, body, { persistent: true });
            await readyChannel.waitForConfirms();
            return true;
        } catch (error) {
            console.error(
                `[listener-service] Publish failed (${routingKey}) attempt ${attempt}${
                    unlimitedAttempts ? "" : `/${maxAttempts}`
                }: ${error.message}`,
            );

            if (!unlimitedAttempts && attempt >= maxAttempts) {
                return false;
            }

            await wait(retryDelayMs);
        }
    }

    return false;
}

module.exports = { connectRabbitMQ, getChannel, publishWithRetry, EXCHANGE };
