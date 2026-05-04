const { ethers } = require("ethers");
const { getChannel, EXCHANGE } = require("../config/rabbitmq");
const { CONTRACT_ABI, resolveContractConfig } = require("../config/contract");

const QUEUE = "blockchain.sync.fail.queue";
const ROUTING_KEY = "blockchain.milestone.failed";

async function startSyncBlockchainFailureConsumer() {
    const channel = getChannel();
    if (!channel) {
        console.warn("[listener-service] RabbitMQ channel unavailable. Skip sync consumer.");
        return;
    }

    const resolved = resolveContractConfig();
    const privateKey = process.env.MARK_FAILED_PRIVATE_KEY || process.env.PRIVATE_KEY;

    if (!resolved || !privateKey) {
        console.warn("[listener-service] Sync consumer disabled: missing contract config or private key.");
        return;
    }

    await channel.assertQueue(QUEUE, { durable: true });
    await channel.bindQueue(QUEUE, EXCHANGE, ROUTING_KEY);
    channel.prefetch(1);

    console.log(`[listener-service] Listening for ${ROUTING_KEY} to sync to Blockchain...`);

    channel.consume(QUEUE, async (msg) => {
        if (!msg) return;

        try {
            const payload = JSON.parse(msg.content.toString());
            const { campaignId, milestoneId } = payload;

            if (campaignId === undefined) {
                console.error("[listener-service] Missing campaignId in sync payload");
                channel.ack(msg);
                return;
            }

            // Setup Ethers
            const provider = new ethers.JsonRpcProvider(resolved.rpcUrls[0]);
            const wallet = new ethers.Wallet(privateKey, provider);
            const contract = new ethers.Contract(resolved.contractAddress, CONTRACT_ABI, wallet);

            if (milestoneId !== undefined) {
                // MILESTONE FAILURE SYNC
                console.log(`[listener-service] Syncing Milestone #${milestoneId} failure for Campaign #${campaignId}...`);
                
                const milestone = await contract.getMilestone(BigInt(campaignId), BigInt(milestoneId));
                if (Number(milestone.status) === 4) { // Already failed
                    console.log(`[listener-service] Milestone #${milestoneId} already failed on-chain. Skipping.`);
                    channel.ack(msg);
                    return;
                }

                const tx = await contract.markMilestoneFailed(BigInt(campaignId), BigInt(milestoneId));
                console.log(`[listener-service] markMilestoneFailed Tx sent: ${tx.hash}`);
                await tx.wait();
            } else {
                // CAMPAIGN FAILURE SYNC (Funding failure)
                console.log(`[listener-service] Syncing Campaign #${campaignId} failure (Funding deadline)...`);
                
                const campaign = await contract.getCampaign(BigInt(campaignId));
                if (Number(campaign.status) === 5) { // Failed = 5
                    console.log(`[listener-service] Campaign #${campaignId} already failed on-chain. Skipping.`);
                    channel.ack(msg);
                    return;
                }

                const tx = await contract.markCampaignFailed(BigInt(campaignId));
                console.log(`[listener-service] markCampaignFailed Tx sent: ${tx.hash}`);
                await tx.wait();
            }
            
            console.log(`[listener-service] On-chain sync successful for Campaign #${campaignId}`);
            channel.ack(msg);
        } catch (error) {
            console.error("[listener-service] Sync consumer error:", error.message);
            // If it's a revert or specific error, maybe ack anyway to avoid infinite loop
            if (error.message.includes("revert") || error.message.includes("already")) {
                channel.ack(msg);
            } else {
                channel.nack(msg, false, false);
            }
        }
    });
}

module.exports = { startSyncBlockchainFailureConsumer };
