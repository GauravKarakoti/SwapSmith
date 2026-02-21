/**
 * Centralized address validation patterns and utility.
 *
 * Every chain-specific regex lives here so that both the bot runtime
 * and any test / validation scripts share a single source of truth.
 */

// --- Regex patterns for validating wallet addresses by chain type ---

export const ADDRESS_PATTERNS: Record<string, RegExp> = {
    // EVM-compatible chains (Ethereum, BSC, Polygon, Arbitrum, Base, Avalanche, etc.)
    ethereum: /^0x[a-fA-F0-9]{40}$/,
    bsc: /^0x[a-fA-F0-9]{40}$/,
    polygon: /^0x[a-fA-F0-9]{40}$/,
    arbitrum: /^0x[a-fA-F0-9]{40}$/,
    base: /^0x[a-fA-F0-9]{40}$/,
    avalanche: /^0x[a-fA-F0-9]{40}$/,
    optimism: /^0x[a-fA-F0-9]{40}$/,
    fantom: /^0x[a-fA-F0-9]{40}$/,
    // Bitcoin (Legacy, SegWit, Native SegWit, Taproot)
    bitcoin: /^(1[a-km-zA-HJ-NP-Z1-9]{25,34}|3[a-km-zA-HJ-NP-Z1-9]{25,34}|bc1[a-zA-HJ-NP-Z0-9]{39,59}|bc1p[qpzry9x8gf2tvdw0s3jn54khce6mua7l]{58})$/,
    // Litecoin (Legacy, SegWit)
    litecoin: /^([LM3][a-km-zA-HJ-NP-Z1-9]{26,33}|ltc1[a-zA-HJ-NP-Z0-9]{39,59})$/,
    // Solana
    solana: /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
    // Tron
    tron: /^T[a-zA-HJ-NP-Z0-9]{33}$/,
    // Ripple (XRP)
    ripple: /^r[0-9a-zA-Z]{24,34}$/,
    xrp: /^r[0-9a-zA-Z]{24,34}$/,
    // Dogecoin
    dogecoin: /^D[5-9A-HJ-NP-U][1-9A-HJ-NP-Za-km-z]{32}$/,
    // Cosmos-based chains
    cosmos: /^cosmos[a-z0-9]{38,45}$/,
    // Polkadot
    polkadot: /^1[a-zA-Z0-9]{47}$/,
    // Cardano
    cardano: /^addr1[a-zA-Z0-9]{53,}$/,
    // Monero
    monero: /^4[0-9AB][1-9A-HJ-NP-Za-km-z]{93}$/,
    // Zcash (transparent)
    zcash: /^t1[a-zA-Z0-9]{33}$/,
};

// Default EVM pattern for unknown chains
export const DEFAULT_EVM_PATTERN = /^0x[a-fA-F0-9]{40}$/;

/**
 * Validates a wallet address against the expected format for a given chain.
 * @param address - The wallet address to validate
 * @param chain - The blockchain network (e.g., 'ethereum', 'bitcoin', 'solana')
 * @returns boolean indicating if the address is valid for the specified chain
 */
export function isValidAddress(address: string, chain?: string): boolean {
    if (!address || typeof address !== 'string') {
        return false;
    }

    const trimmedAddress = address.trim();

    // If no chain specified, check if it matches any known pattern
    if (!chain) {
        // Check EVM first (most common)
        if (DEFAULT_EVM_PATTERN.test(trimmedAddress)) {
            return true;
        }
        // Check other common patterns
        for (const pattern of Object.values(ADDRESS_PATTERNS)) {
            if (pattern.test(trimmedAddress)) {
                return true;
            }
        }
        return false;
    }

    // Normalize chain name
    const normalizedChain = chain.toLowerCase().replace(/[^a-z]/g, '');

    // Get the pattern for the specified chain
    const pattern = ADDRESS_PATTERNS[normalizedChain];

    if (pattern) {
        return pattern.test(trimmedAddress);
    }

    // For unknown chains, assume EVM-compatible
    return DEFAULT_EVM_PATTERN.test(trimmedAddress);
}
