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

  describe('Category A: Full Balance Keywords', () => {
    it('should parse "Swap everything to BTC"', async () => {
      const result = await parseUserCommand('Swap everything to BTC');
      expect(result.intent).toBe('swap');
      expect(result.amountType).toBe('all');
      expect(result.toAsset).toBe('BTC');
    });

    it('should parse "Convert all ETH to USDT"', async () => {
      const result = await parseUserCommand('Convert all ETH to USDT');
      expect(result.intent).toBe('swap');
      expect(result.amountType).toBe('all');
      expect(result.fromAsset).toBe('ETH');
      expect(result.toAsset).toBe('USDT');
    });

    it('should parse "Send max BTC"', async () => {
      const result = await parseUserCommand('Send max BTC');
      expect(result.intent).toBe('swap'); // or 'send'? The prompt says 'swap' usually implies sending/converting.
      expect(result.amountType).toBe('all');
      expect(result.fromAsset).toBe('BTC');
    });

    it('should parse "Transfer entire balance to USDC"', async () => {
      const result = await parseUserCommand('Transfer entire balance to USDC');
      expect(result.intent).toBe('swap');
      expect(result.amountType).toBe('all');
      expect(result.toAsset).toBe('USDC');
    });
  });

  describe('Category B: Percentages', () => {
    it('should parse "Swap 50% ETH to BTC"', async () => {
      const result = await parseUserCommand('Swap 50% ETH to BTC');
      expect(result.intent).toBe('swap');
      expect(result.amountType).toBe('percentage');
      expect(result.amount).toBe(50);
      expect(result.fromAsset).toBe('ETH');
      expect(result.toAsset).toBe('BTC');
    });

    it('should parse "Convert 25% SOL"', async () => {
      const result = await parseUserCommand('Convert 25% SOL');
      expect(result.intent).toBe('swap');
      expect(result.amountType).toBe('percentage');
      expect(result.amount).toBe(25);
      expect(result.fromAsset).toBe('SOL');
    });

    it('should parse "Swap half MATIC"', async () => {
      const result = await parseUserCommand('Swap half MATIC');
      expect(result.intent).toBe('swap');
      expect(result.amountType).toBe('percentage');
      expect(result.amount).toBe(50);
      expect(result.fromAsset).toBe('MATIC');
    });

    it('should parse "Swap 10 percent AVAX"', async () => {
      const result = await parseUserCommand('Swap 10 percent AVAX');
      expect(result.intent).toBe('swap');
      expect(result.amountType).toBe('percentage');
      expect(result.amount).toBe(10);
      expect(result.fromAsset).toBe('AVAX');
    });
  });

  describe('Category C: Exclusion Logic', () => {
    it('should parse "Swap everything except 10 MATIC"', async () => {
      const result = await parseUserCommand('Swap everything except 10 MATIC');
      expect(result.intent).toBe('swap');
      expect(result.amountType).toBe('all');
      expect(result.excludeAmount).toBe(10);
      expect(result.excludeToken).toBe('MATIC');
    });

    it('should parse "Convert all ETH except 0.1"', async () => {
      const result = await parseUserCommand('Convert all ETH except 0.1');
      expect(result.intent).toBe('swap');
      expect(result.amountType).toBe('all');
      expect(result.fromAsset).toBe('ETH');
      expect(result.excludeAmount).toBe(0.1);
    });

     it('should parse "Swap everything except 25%"', async () => {
      const result = await parseUserCommand('Swap everything except 25%');
       expect(result.intent).toBe('swap');
      expect(result.amountType).toBe('all');
      // Logic for percentage exclusion?
      // The plan regex for exclusion is `/everything\s+except\s+(\d+(\.\d+)?)\s+([A-Z]+)/i` which expects a token.
      // But "except 25%" might be handled differently.
      // For now, let's assume the regex handles "except 25%" as "excludeAmount=25, excludeToken=undefined" or similar.
      // Or maybe the parser should handle it.
      // I'll stick to the explicit token test for now, or adapt based on implementation.
    });
  });

  describe('Category D: Ambiguous Prepositions', () => {
    it('should parse "Convert 100 USDT into ETH"', async () => {
      const result = await parseUserCommand('Convert 100 USDT into ETH');
      expect(result.intent).toBe('swap');
      expect(result.amount).toBe(100);
      expect(result.fromAsset).toBe('USDT');
      expect(result.toAsset).toBe('ETH');
    });

    it('should parse "Swap from ETH to BTC"', async () => {
      const result = await parseUserCommand('Swap from ETH to BTC');
      expect(result.intent).toBe('swap');
      expect(result.fromAsset).toBe('ETH');
      expect(result.toAsset).toBe('BTC');
    });

    it('should parse "Send 1 ETH for USDT"', async () => {
      const result = await parseUserCommand('Send 1 ETH for USDT');
      expect(result.intent).toBe('swap');
      expect(result.amount).toBe(1);
      expect(result.fromAsset).toBe('ETH');
      expect(result.toAsset).toBe('USDT');
    });
  });

  describe('Category E: Invalid Inputs', () => {
    it('should handle "Swap ETH" (missing destination/amount)', async () => {
      const result = await parseUserCommand('Swap ETH');
      // Expecting failure (fallback to LLM which is mocked to fail)
      // Or ambiguous result?
      expect(result.success).toBe(false);
    });

     it('should handle "Convert to BTC" (missing source)', async () => {
      const result = await parseUserCommand('Convert to BTC');
      expect(result.success).toBe(false);
    });
  });

});
