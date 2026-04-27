const axios = require("axios");
const FormData = require("form-data");

/**
 * IPFS Upload Service via Pinata
 * Handles retry logic with exponential backoff
 */

const PINATA_CONFIG = {
    API_KEY: process.env.PINATA_API_KEY || "",
    API_SECRET: process.env.PINATA_API_SECRET || "",
    GATEWAY_URL:
        process.env.PINATA_GATEWAY_URL || "https://gateway.pinata.cloud",
};

const RETRY_CONFIG = {
    maxRetries: 3,
    delays: [300, 900, 2700], // 300ms, 900ms, 2700ms (exponential backoff)
};

/**
 * Upload file buffer to IPFS via Pinata
 * @param {Buffer} fileBuffer - File content as buffer
 * @param {string} filename - Original filename
 * @param {Object} metadata - Custom metadata {"milestone": "2", "type": "report"}
 * @returns {Promise<{cid: string, ipfsUrl: string, pinataUrl: string}>}
 * @throws {Error} After 3 retries failed
 */
async function uploadToIPFS(fileBuffer, filename, metadata = {}) {
    if (!PINATA_CONFIG.API_KEY || !PINATA_CONFIG.API_SECRET) {
        throw new Error("PINATA_API_KEY or PINATA_API_SECRET not configured");
    }

    const form = new FormData();
    form.append("file", fileBuffer, { filename });

    // Include metadata in Pinata format
    const pinataMetadata = {
        name: filename,
        keyvalues: {
            uploadedAt: new Date().toISOString(),
            ...metadata,
        },
    };
    form.append("pinataMetadata", JSON.stringify(pinataMetadata));

    const axiosInstance = axios.create({
        headers: {
            pinata_api_key: PINATA_CONFIG.API_KEY,
            pinata_secret_api_key: PINATA_CONFIG.API_SECRET,
            ...form.getHeaders(),
        },
    });

    let lastError;

    for (let attempt = 0; attempt < RETRY_CONFIG.maxRetries; attempt++) {
        try {
            const response = await axiosInstance.post(
                "https://api.pinata.cloud/pinning/pinFileToIPFS",
                form,
                { timeout: 30000 },
            );

            const cid = response.data.IpfsHash;
            const ipfsUrl = `ipfs://${cid}`;
            const pinataUrl = `${PINATA_CONFIG.GATEWAY_URL}/ipfs/${cid}`;

            console.log(
                `[uploadToIPFS] SUCCESS on attempt ${attempt + 1}: CID=${cid}`,
            );

            return { cid, ipfsUrl, pinataUrl };
        } catch (error) {
            lastError = error;
            const delay = RETRY_CONFIG.delays[attempt];

            console.warn(
                `[uploadToIPFS] Attempt ${attempt + 1} failed: ${error.message}. ` +
                `Retrying in ${delay}ms...`,
            );

            if (attempt < RETRY_CONFIG.maxRetries - 1) {
                await new Promise((resolve) => setTimeout(resolve, delay));
            }
        }
    }

    console.error(
        `[uploadToIPFS] All ${RETRY_CONFIG.maxRetries} attempts failed`,
    );
    throw new Error(
        `Failed to upload to IPFS after ${RETRY_CONFIG.maxRetries} retries: ${lastError.message}`,
    );
}

/**
 * Verify if file exists on IPFS (CID integrity check)
 * @param {string} cid - IPFS content identifier
 * @returns {Promise<boolean>}
 */
async function verifyCIDExists(cid) {
    try {
        const response = await axios.head(
            `${PINATA_CONFIG.GATEWAY_URL}/ipfs/${cid}`,
            { timeout: 5000 },
        );
        return response.status === 200;
    } catch (error) {
        console.warn(
            `[verifyCIDExists] CID ${cid} verification failed: ${error.message}`,
        );
        return false;
    }
}

/**
 * Unpin file from Pinata (cleanup)
 * @param {string} cid - IPFS content identifier
 * @returns {Promise<void>}
 */
async function unpinFromIPFS(cid) {
    try {
        await axios.delete(`https://api.pinata.cloud/pinning/unpin/${cid}`, {
            headers: {
                pinata_api_key: PINATA_CONFIG.API_KEY,
                pinata_secret_api_key: PINATA_CONFIG.API_SECRET,
            },
        });
        console.log(`[unpinFromIPFS] Successfully unpinned CID=${cid}`);
    } catch (error) {
        console.error(
            `[unpinFromIPFS] Failed to unpin CID=${cid}: ${error.message}`,
        );
    }
}

module.exports = {
    uploadToIPFS,
    verifyCIDExists,
    unpinFromIPFS,
};
