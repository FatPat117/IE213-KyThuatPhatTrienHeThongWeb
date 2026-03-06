const { errorRes } = require("../utils/response");

function validateAddress(req, res, next) {
    const wallet = req.params.wallet;
    if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet.trim())) {
        return errorRes(res, "Invalid Ethereum address", 400);
    }
    next();
}

module.exports = validateAddress;
