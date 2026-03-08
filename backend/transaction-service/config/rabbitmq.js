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
        console.log("[transaction-service] Đã kết nối RabbitMQ");

        await channel.assertExchange(EXCHANGE, "topic", { durable: true });

        // Tạo 1 queue riêng cho service này
        const q = await channel.assertQueue(QUEUE, { durable: true });

        // Theo dõi routing key tương ứng
        await channel.bindQueue(q.queue, EXCHANGE, ROUTING_KEY);

        console.log(`[transaction-service] Đang lắng nghe queue = ${q.queue}`);

        // Bắt đầu nhận tin
        channel.consume(
            q.queue,
            async (msg) => {
                if (msg !== null) {
                    try {
                        const content = JSON.parse(msg.content.toString());
                        console.log(`[transaction-service] Nhận message từ ${msg.fields.routingKey}:`, content);
                        await handleDonationEvent(msg.fields.routingKey, content);

                        channel.ack(msg);
                    } catch (error) {
                        console.error("[transaction-service] Lỗi xử lý message:", error);
                        // Tạm nack để thử lại
                        channel.nack(msg, false, false);
                    }
                }
            },
            { noAck: false }
        );
    } catch (error) {
        console.error("[transaction-service] KHÔNG THỂ KẾT NỐI RabbitMQ:", error.message);
        setTimeout(connectRabbitMQ, 5000); // Reconnect sau 5s
    }
}

// Xử lý logic
async function handleDonationEvent(routingKey, content) {
    if (routingKey === ROUTING_KEY) {
        // payload: { campaignId, donor, amount, txHash }

        // Tiêu chuẩn Schema Transaction:
        // { txHash, walletAddress, action, status, campaignOnChainId }
        const exist = await Transaction.findOne({ txHash: content.txHash });
        if (exist) {
            console.log(`[transaction-service] TX ${content.txHash} đã tồn tại, skip.`);
            return;
        }

        const newTx = new Transaction({
            txHash: content.txHash,
            walletAddress: content.donor,
            action: "donate",
            status: "success",
            campaignOnChainId: Number(content.campaignId),
        });

        await newTx.save();
        console.log(`[transaction-service] Đã lưu giao dịch ${content.txHash} vào DB.`);
    }
}

module.exports = { connectRabbitMQ };
