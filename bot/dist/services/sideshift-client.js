"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPairs = getPairs;
exports.createQuote = createQuote;
exports.createOrder = createOrder;
exports.getOrderStatus = getOrderStatus;
exports.createCheckout = createCheckout;
const axios_1 = __importDefault(require("axios"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const SIDESHIFT_BASE_URL = "https://sideshift.ai/api/v2";
const AFFILIATE_ID = process.env.NEXT_PUBLIC_AFFILIATE_ID;
const API_KEY = process.env.NEXT_PUBLIC_SIDESHIFT_API_KEY;
// --- END NEW ---
async function getPairs() {
    try {
        const response = await axios_1.default.get(`${SIDESHIFT_BASE_URL}/pairs`, {
            headers: {
                'x-sideshift-secret': API_KEY,
                'x-user-ip': '0.0.0.0'
            },
        });
        return response.data;
    }
    catch (error) {
        if (axios_1.default.isAxiosError(error)) {
            throw new Error(error.response?.data?.error?.message || 'Failed to fetch trading pairs');
        }
        throw new Error("Failed to fetch trading pairs");
    }
}
async function createQuote(fromAsset, fromNetwork, toAsset, toNetwork, amount, userIP) {
    try {
        const response = await axios_1.default.post(`${SIDESHIFT_BASE_URL}/quotes`, {
            depositCoin: fromAsset,
            depositNetwork: fromNetwork,
            settleCoin: toAsset,
            settleNetwork: toNetwork,
            depositAmount: amount.toString(),
            affiliateId: AFFILIATE_ID,
        }, {
            headers: {
                'Content-Type': 'application/json',
                'x-sideshift-secret': API_KEY,
                'x-user-ip': userIP
            }
        });
        if (response.data.error) {
            throw new Error(response.data.error.message);
        }
        return {
            ...response.data,
            id: response.data.id
        };
    }
    catch (error) {
        if (axios_1.default.isAxiosError(error)) {
            throw new Error(error.response?.data?.error?.message || `Failed to create quote for ${fromAsset} to ${toAsset}`);
        }
        throw new Error(`Failed to create quote for ${fromAsset} to ${toAsset}`);
    }
}
async function createOrder(quoteId, settleAddress, refundAddress) {
    try {
        const response = await axios_1.default.post(`${SIDESHIFT_BASE_URL}/shifts/fixed`, {
            quoteId,
            settleAddress,
            refundAddress,
            affiliateId: AFFILIATE_ID,
        }, {
            headers: {
                'Content-Type': 'application/json',
                'x-sideshift-secret': API_KEY,
                'x-user-ip': '1.1.1.1'
            }
        });
        return response.data;
    }
    catch (error) {
        if (axios_1.default.isAxiosError(error)) {
            throw new Error(error.response?.data?.error?.message || 'Failed to create order');
        }
        throw new Error('Failed to create order');
    }
}
// --- NEW: Function to get order status ---
async function getOrderStatus(orderId) {
    try {
        const response = await axios_1.default.get(`${SIDESHIFT_BASE_URL}/shifts/${orderId}`, {
            headers: {
                'Accept': 'application/json',
                'x-sideshift-secret': API_KEY,
                'x-user-ip': '1.1.1.1'
            }
        });
        return response.data;
    }
    catch (error) {
        if (axios_1.default.isAxiosError(error)) {
            throw new Error(error.response?.data?.error?.message || 'Failed to get order status');
        }
        throw new Error('Failed to get order status');
    }
}
// --- END NEW ---
// --- NEW: Function for SideShift Pay API ---
async function createCheckout(settleCoin, settleNetwork, settleAmount, settleAddress, userIP) {
    const payload = {
        settleCoin,
        settleNetwork,
        settleAmount: settleAmount.toString(),
        settleAddress,
        affiliateId: AFFILIATE_ID || '',
        // Using placeholder URLs as this is a bot and we just need the link
        successUrl: 'https://sideshift.ai/success',
        cancelUrl: 'https://sideshift.ai/cancel',
    };
    try {
        const response = await axios_1.default.post(`${SIDESHIFT_BASE_URL}/checkout`, payload, {
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'x-sideshift-secret': API_KEY,
                'x-user-ip': userIP,
            },
        });
        if (response.data.error) {
            throw new Error(response.data.error.message);
        }
        return response.data;
    }
    catch (error) {
        if (axios_1.default.isAxiosError(error)) {
            throw new Error(error.response?.data?.error?.message || 'Failed to create checkout');
        }
        throw new Error('Failed to create checkout');
    }
}
// --- END NEW ---
