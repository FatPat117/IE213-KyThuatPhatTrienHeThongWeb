const amqp = require('amqplib');

async function sendMockEvent(routingKey, payload) {
    const connection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://localhost');
    const channel = await connection.createChannel();
    const EXCHANGE = 'funding.events'; // Đảm bảo khớp với config của ông

    await channel.assertExchange(EXCHANGE, 'topic', { durable: true });
    channel.publish(EXCHANGE, routingKey, Buffer.from(JSON.stringify(payload)));

    console.log(` [x] Sent ${routingKey}`);
    setTimeout(() => { connection.close(); }, 500);
}

// --- CHỌN FLOW ĐỂ TEST BẰNG CÁCH UNCOMMENT ---

// 1. Test Flow Tạo Campaign (P1-03 -> P3-01)
// sendMockEvent('campaign.created', {
//     onChainId: "1",
//     creator: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
//     goalWei: "1000000000000000000",
//     deadline: Math.floor(Date.now() / 1000) + 86400,
//     milestoneCount: "2"
// });

// 2. Test Flow Quyên góp (P3-07 - Quan trọng: check CampaignDonorShare)
// sendMockEvent('donation.received', {
//     campaignOnChainId: "1",
//     donorWallet: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
//     amount: "500000000000000000", // 0.5 ETH
//     totalRaisedWei: "500000000000000000"
// });

// 3. Test Flow Hoàn thành quyên góp (P3-01, P3-07 - Check ShareBps)
// sendMockEvent('campaign.funding.completed', {
//     campaignId: "1",
//     totalRaisedWei: "1000000000000000000",
//     goalReachedAt: Math.floor(Date.now() / 1000)
// });
