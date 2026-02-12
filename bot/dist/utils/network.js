"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.inferNetwork = inferNetwork;
function inferNetwork(asset) {
    const map = {
        'BTC': 'bitcoin',
        'ETH': 'ethereum',
        'SOL': 'solana',
        'USDT': 'ethereum',
        'USDC': 'ethereum',
        'DAI': 'ethereum',
        'WBTC': 'ethereum',
        'BNB': 'bsc',
        'AVAX': 'avalanche',
        'MATIC': 'polygon',
        'ARB': 'arbitrum',
        'OP': 'optimism',
        'BASE': 'base'
    };
    return map[asset?.toUpperCase()] || 'ethereum';
}
