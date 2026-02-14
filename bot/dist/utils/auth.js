"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateWebAppData = validateWebAppData;
const crypto_1 = require("crypto");
function validateWebAppData(initData, botToken) {
    if (!initData)
        return null;
    try {
        const urlParams = new URLSearchParams(initData);
        const hash = urlParams.get('hash');
        if (!hash)
            return null;
        urlParams.delete('hash');
        const sortedParams = Array.from(urlParams.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([key, val]) => `${key}=${val}`)
            .join('\n');
        // Calculate HMAC
        // The secret key is the HMAC-SHA256 signature of the bot token with the constant string "WebAppData" used as the key.
        const secretKey = (0, crypto_1.createHmac)('sha256', 'WebAppData').update(botToken).digest();
        const calculatedHash = (0, crypto_1.createHmac)('sha256', secretKey).update(sortedParams).digest('hex');
        if (calculatedHash === hash) {
            const userStr = urlParams.get('user');
            if (userStr) {
                return JSON.parse(userStr);
            }
        }
        return null;
    }
    catch (error) {
        console.error("Auth Error:", error);
        return null;
    }
}
