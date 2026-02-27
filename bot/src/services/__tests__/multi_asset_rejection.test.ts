
jest.mock('../groq-client', () => ({
    parseWithLLM: jest.fn().mockResolvedValue({
        success: false,
        intent: 'unknown',
        confidence: 0,
        validationErrors: ['Mock fallback failed'],
        parsedMessage: '',
        fromAsset: null, fromChain: null, toAsset: null, toChain: null, amount: null,
        settleAsset: null, settleNetwork: null, settleAmount: null, settleAddress: null
    })
}));

import { parseUserCommand } from '../parseUserCommand';

console.error("TEST_STARTING");

describe('Issue #276: NLP Parser Multi-Asset Commands', () => {
    it('should detect multiple source assets "Swap my ETH and MATIC for USDC on Arbitrum"', async () => {
        const input = "Swap my ETH and MATIC for USDC on Arbitrum";
        const result = await parseUserCommand(input);

        // We expect it to FAIL or specifically detect multi-source
        if (result.success) {
            throw new Error("Parsed incorrectly as success: " + JSON.stringify(result, null, 2));
        }

        // Ideally, it should satisfy one of these:
        // 1. Success with MULTIPLE intents (not yet implemented in structure)
        // 2. Failure with specific validation error

        // The current implementation attempts to enforce restriction via REGEX_MULTI_SOURCE.
        // So we expect it to return success: false with specific validation error.

        expect(result.success).toBe(false);
        expect(result.validationErrors).toContain('Multiple source assets not supported');
    });

    it('should detect "Swap ETH and MATIC to USDC"', async () => {
        const input = "Swap ETH and MATIC to USDC";
        const result = await parseUserCommand(input);
        expect(result.success).toBe(false);
        expect(result.validationErrors).toContain('Multiple source assets not supported');
    });

    it('should detect "Convert BTC & ETH to USDC"', async () => {
        const input = "Convert BTC & ETH to USDC";
        const result = await parseUserCommand(input);
        expect(result.success).toBe(false);
        expect(result.validationErrors).toContain('Multiple source assets not supported');
    });
});
