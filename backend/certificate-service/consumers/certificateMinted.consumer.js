const { getChannel, EXCHANGE } = require("../config/rabbitmq");
const certificateService = require("../services/certificate.service");

const QUEUE = process.env.RABBITMQ_QUEUE_CERT_MINTED || "cert.minted.queue";
const ROUTING_KEY = process.env.RABBITMQ_RKEY_CERT_MINTED || "certificate.minted";
const USER_SERVICE_URL = (process.env.USER_SERVICE_URL || "http://user-service:4001").replace(/\/+$/, "");
const CAMPAIGN_SERVICE_URL = (process.env.CAMPAIGN_SERVICE_URL || "http://campaign-service:4002").replace(/\/+$/, "");
const DONATION_SERVICE_URL = (process.env.DONATION_SERVICE_URL || "http://donation-service:4003").replace(/\/+$/, "");
const FRONTEND_BASE_URL = (process.env.FRONTEND_BASE_URL || "http://localhost:3000").replace(/\/+$/, "");

function shortWallet(wallet) {
    if (!wallet || wallet.length < 10) return wallet || "Anonymous donor";
    return `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
}

function formatWeiToEth(wei) {
    const WEI_PER_ETH = 10n ** 18n;
    const whole = wei / WEI_PER_ETH;
    const fraction = wei % WEI_PER_ETH;
    const fractionPadded = fraction.toString().padStart(18, "0");
    const fraction4 = fractionPadded.slice(0, 4).replace(/0+$/, "");
    return fraction4 ? `${whole.toString()}.${fraction4}` : whole.toString();
}

function buildCertificateMessage(displayName, donatedAmountEth, campaignTitle) {
    return `Xin cảm ơn anh/chị ${displayName} đã quyên góp ${donatedAmountEth} ETH cho chiến dịch "${campaignTitle}".`;
}

async function fetchServiceData(baseUrl, path) {
    try {
        const response = await fetch(`${baseUrl}${path}`);
        if (!response.ok) return null;
        const payload = await response.json();
        if (!payload?.success) return null;
        return payload.data;
    } catch {
        return null;
    }
}

async function resolveCertificateDetails(payload) {
    const ownerWallet = String(payload.ownerWallet || "").toLowerCase();
    const campaignId = Number(payload.campaignOnChainId);

    const [profile, campaign, donations] = await Promise.all([
        fetchServiceData(USER_SERVICE_URL, `/api/users/${ownerWallet}`),
        fetchServiceData(CAMPAIGN_SERVICE_URL, `/api/campaigns/${campaignId}`),
        fetchServiceData(DONATION_SERVICE_URL, `/api/donations/campaign/${campaignId}`),
    ]);

    const displayName = (profile?.displayName || "").trim() || shortWallet(ownerWallet);
    const campaignTitle = (campaign?.title || "").trim() || `Campaign #${campaignId}`;

    const rows = Array.isArray(donations) ? donations : [];
    const donatedRows = rows.filter((row) => String(row?.donorWallet || "").toLowerCase() === ownerWallet);
    const donatedWei = donatedRows.reduce((sum, row) => {
        try {
            return sum + BigInt(String(row.amount || "0"));
        } catch {
            return sum;
        }
    }, 0n);
    const donatedAmountEth = formatWeiToEth(donatedWei);

    const certificateMessage = buildCertificateMessage(displayName, donatedAmountEth, campaignTitle);
    const metadata = {
        name: `Certificate #${payload.tokenId} - ${campaignTitle}`,
        description: certificateMessage,
        external_url: `${FRONTEND_BASE_URL}/campaigns/${campaignId}`,
        attributes: [
            { trait_type: "Display Name", value: displayName },
            { trait_type: "Donor Wallet", value: ownerWallet },
            { trait_type: "Campaign ID", value: campaignId },
            { trait_type: "Campaign Title", value: campaignTitle },
            { trait_type: "Donated Amount (ETH)", value: donatedAmountEth },
            { trait_type: "Token ID", value: Number(payload.tokenId) },
        ],
    };

    const metadataUri = `data:application/json;base64,${Buffer.from(JSON.stringify(metadata), "utf8").toString("base64")}`;

    return {
        displayName,
        campaignTitle,
        donatedAmountEth: Number(donatedAmountEth) || 0,
        certificateMessage,
        metadataUri,
    };
}

// TODO: Implement sau khi NFT contract (ERC-721) được viết và deploy
async function startCertificateMintedConsumer() {
    const channel = getChannel();
    if (!channel) {
        console.warn("[certificate-service] RabbitMQ channel không có – bỏ qua consumer");
        return;
    }

    await channel.assertQueue(QUEUE, { durable: true });
    await channel.bindQueue(QUEUE, EXCHANGE, ROUTING_KEY);
    channel.prefetch(1);

    console.log(`[certificate-service] Consumer đang lắng nghe queue: ${QUEUE}`);

    channel.consume(QUEUE, async (msg) => {
        if (!msg) return;
        try {
            const payload = JSON.parse(msg.content.toString());
            console.log("[certificate-service] Nhận event certificate.minted:", payload);

            /**
             * Payload từ listener-service:
             * { tokenId, campaignOnChainId, ownerWallet, txHash }
             */
            const details = await resolveCertificateDetails(payload);
            await certificateService.createCertificate({
                tokenId: payload.tokenId,
                campaignOnChainId: payload.campaignOnChainId,
                ownerWallet: payload.ownerWallet,
                metadataUri: payload.metadataUri || details.metadataUri || `ipfs://default-nft-metadata/${payload.tokenId}`,
                displayName: details.displayName,
                campaignTitle: details.campaignTitle,
                donatedAmountEth: details.donatedAmountEth,
                certificateMessage: details.certificateMessage,
                mintedAt: new Date(),
            });

            console.log(`[certificate-service] Đã lưu certificate tokenId=${payload.tokenId}`);
            channel.ack(msg);
        } catch (err) {
            console.error("[certificate-service] Consumer error:", err.message);
            channel.nack(msg, false, false);
        }
    });
}

module.exports = { startCertificateMintedConsumer };
