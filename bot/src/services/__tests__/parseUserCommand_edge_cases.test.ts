// Mock needs to be before imports that use it
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

describe('parseUserCommand Edge Cases', () => {

  describe('1️⃣ Exclusion Commands', () => {
    it('should parse "Swap everything except 10 MATIC"', async () => {
      const result = await parseUserCommand('Swap everything except 10 MATIC');
      expect(result.intent).toBe('swap');
      expect(result.amountType).toBe('all');
      expect(result.excludeAmount).toBe(10);
      expect(result.excludeToken).toBe('MATIC');
    });

    it('should parse "Swap all USDC but keep 100"', async () => {
      const result = await parseUserCommand('Swap all USDC but keep 100');
      expect(result.intent).toBe('swap');
      expect(result.amountType).toBe('all');
      expect(result.fromAsset).toBe('USDC');
      expect(result.excludeAmount).toBe(100);
      // excludeToken might default to fromAsset if not specified explicitly
      // or remain undefined if parser logic handles it.
      // Based on current logic, if exclude token is missing, it might not set it.
      // But let's check basic requirement: excludeAmount IS captured.
    });
  });

  describe('2️⃣ Partial + Percentage', () => {
    it('should parse "Swap 50% of my ETH"', async () => {
      const result = await parseUserCommand('Swap 50% of my ETH');
      expect(result.intent).toBe('swap');
      expect(result.amountType).toBe('percentage');
      expect(result.amount).toBe(50);
      expect(result.fromAsset).toBe('ETH');
    });

    it('should parse "Swap 25 percent of USDT"', async () => {
      const result = await parseUserCommand('Swap 25 percent of USDT');
      expect(result.intent).toBe('swap');
      expect(result.amountType).toBe('percentage');
      expect(result.amount).toBe(25);
      expect(result.fromAsset).toBe('USDT');
    });
  });

  describe('3️⃣ Ambiguous Amount Placement (Quote Amount)', () => {
    it('should parse "Swap ETH worth 100 USDC"', async () => {
      const result = await parseUserCommand('Swap ETH worth 100 USDC');
      expect(result.intent).toBe('swap');
      expect(result.fromAsset).toBe('ETH');
      // expect(result.toAsset).toBe('USDC'); // It might infer USDC as toAsset or just quote currency
      // The key requirement is quoteAmount
      // If "worth 100 USDC", 100 is NOT the input amount of ETH.
      // It should be stored in quoteAmount (new field).
      // Since quoteAmount isn't in interface yet, this test will fail compilation or check.
      // We expect this to fail initially.
      expect((result as any).quoteAmount).toBe(100);
    });
  });

  describe('4️⃣ Multi-token Phrases', () => {
    it('should detect multiple source tokens and return error: "Swap all ETH and MATIC to USDC"', async () => {
      const result = await parseUserCommand('Swap all ETH and MATIC to USDC');
      // Should fail or return validation error
      expect(result.validationErrors).toEqual(
        expect.arrayContaining([expect.stringMatching(/multiple source assets/i)])
      );
    });
  });

  describe('5️⃣ Natural Fillers', () => {
    it('should ignore fillers: "Hey, can you swap like 100 USDC to ETH?"', async () => {
      const result = await parseUserCommand('Hey, can you swap like 100 USDC to ETH?');
      expect(result.intent).toBe('swap');
      expect(result.amount).toBe(100);
      expect(result.fromAsset).toBe('USDC');
      expect(result.toAsset).toBe('ETH');
    });

    it('should ignore fillers: "Please sell 2 BTC immediately"', async () => {
        const result = await parseUserCommand('Please sell 2 BTC immediately');
        expect(result.intent).toBe('swap'); // 'sell' -> 'swap'
        expect(result.amount).toBe(2);
        expect(result.fromAsset).toBe('BTC');
    });
  });

});
