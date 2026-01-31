/**
 * Kiểm tra địa chỉ ví Ethereum hợp lệ (0x + 40 hex).
 * @param {string} address
 * @returns {boolean}
 */
function isValidAddress(address) {
  if (!address || typeof address !== "string") return false;
  return /^0x[a-fA-F0-9]{40}$/.test(address.trim());
}

module.exports = { isValidAddress };
