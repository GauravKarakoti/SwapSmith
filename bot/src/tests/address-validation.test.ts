/**
 * Address validation tests.
 *
 * These tests import ADDRESS_PATTERNS and isValidAddress directly from the
 * production config (config/address-patterns.ts) so they can never drift
 * out of sync with the patterns the bot actually uses at runtime.
 */

import { ADDRESS_PATTERNS, DEFAULT_EVM_PATTERN, isValidAddress } from '../config/address-patterns';

// --- Pattern coverage ---

describe('ADDRESS_PATTERNS', () => {
    it('contains all expected EVM chains', () => {
        const evmChains = ['ethereum', 'bsc', 'polygon', 'arbitrum', 'base', 'avalanche', 'optimism', 'fantom'];
        for (const chain of evmChains) {
            expect(ADDRESS_PATTERNS[chain]).toBeDefined();
        }
    });

    it('contains non-EVM chains', () => {
        const nonEvmChains = ['bitcoin', 'litecoin', 'solana', 'tron', 'ripple', 'xrp', 'dogecoin', 'cosmos', 'polkadot', 'cardano', 'monero', 'zcash'];
        for (const chain of nonEvmChains) {
            expect(ADDRESS_PATTERNS[chain]).toBeDefined();
        }
    });

    it('DEFAULT_EVM_PATTERN matches a standard EVM address', () => {
        expect(DEFAULT_EVM_PATTERN.test('0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18')).toBe(true);
    });
});

// --- isValidAddress ---

describe('isValidAddress', () => {
    // -- EVM --
    it('accepts a valid Ethereum address', () => {
        expect(isValidAddress('0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18', 'ethereum')).toBe(true);
    });

    it('rejects an Ethereum address that is too short', () => {
        expect(isValidAddress('0x742d35Cc6634C0532925a3b844Bc', 'ethereum')).toBe(false);
    });

    it('rejects an Ethereum address without 0x prefix', () => {
        expect(isValidAddress('742d35Cc6634C0532925a3b844Bc9e7595f2bD18', 'ethereum')).toBe(false);
    });

    // -- Bitcoin --
    it('accepts a valid Bitcoin Legacy address', () => {
        expect(isValidAddress('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa', 'bitcoin')).toBe(true);
    });

    it('accepts a valid Bitcoin SegWit (bc1) address', () => {
        expect(isValidAddress('bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq', 'bitcoin')).toBe(true);
    });

    it('rejects an invalid Bitcoin address', () => {
        expect(isValidAddress('notabitcoinaddress', 'bitcoin')).toBe(false);
    });

    // -- Solana --
    it('accepts a valid Solana address', () => {
        expect(isValidAddress('7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV', 'solana')).toBe(true);
    });

    // -- Tron --
    it('accepts a valid Tron address', () => {
        expect(isValidAddress('TJRyWwFs9wTFGZg3JbrVriFbNfCug5tDeC', 'tron')).toBe(true);
    });

    // -- Ripple / XRP --
    it('accepts a valid Ripple address via "ripple" chain', () => {
        expect(isValidAddress('rDsbeomae4FXwgQTJp9Rs64Qg9vDiTCdBv', 'ripple')).toBe(true);
    });

    it('accepts a valid Ripple address via "xrp" alias', () => {
        expect(isValidAddress('rDsbeomae4FXwgQTJp9Rs64Qg9vDiTCdBv', 'xrp')).toBe(true);
    });

    // -- Cosmos --
    it('accepts a valid Cosmos address', () => {
        expect(isValidAddress('cosmos1hsk6jryyqjfhp5dhc55tc9jtckygx0eph6dd02', 'cosmos')).toBe(true);
    });

    // -- Cardano --
    it('accepts a valid Cardano address', () => {
        expect(isValidAddress('addr1qx2fxv2umyhttkxyxp8x0dlpdt3k6cwng5pxj3jhsydzer3jcu5d8ps7zex2k2xt3uqxgjqnnj83ws8lhrn648jjxtwq2ytjqp', 'cardano')).toBe(true);
    });

    // -- No chain specified --
    it('accepts a valid EVM address when no chain is given', () => {
        expect(isValidAddress('0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18')).toBe(true);
    });

    it('accepts a valid Bitcoin address when no chain is given', () => {
        expect(isValidAddress('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa')).toBe(true);
    });

    // -- Edge cases --
    it('returns false for empty string', () => {
        expect(isValidAddress('')).toBe(false);
    });

    it('returns false for null-ish values', () => {
        expect(isValidAddress(null as unknown as string)).toBe(false);
        expect(isValidAddress(undefined as unknown as string)).toBe(false);
    });

    it('trims whitespace before validating', () => {
        expect(isValidAddress('  0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18  ', 'ethereum')).toBe(true);
    });

    it('falls back to EVM pattern for unknown chains', () => {
        expect(isValidAddress('0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18', 'someUnknownChain')).toBe(true);
    });

    it('normalizes chain names (strips non-alpha chars)', () => {
        expect(isValidAddress('0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18', 'Ethereum')).toBe(true);
        expect(isValidAddress('0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18', 'ETHEREUM')).toBe(true);
    });
});
