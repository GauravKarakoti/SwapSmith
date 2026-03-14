import { parseUserCommand } from '../services/parseUserCommand';
import { generateContextualHelp } from '../services/contextual-help';

// Mock Groq to test deterministic parsing paths
jest.mock('groq-sdk', () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockRejectedValue(new Error("LLM Disabled for Test")),
      },
    },
  }));
});

describe('Enhanced AI Parsing - Edge Cases & Ambiguity Handling', () => {

  describe('Ambiguity Detection', () => {
    test('should detect multiple destination assets', async () => {
      const result = await parseUserCommand('Swap all my ETH to BTC or USDC');
      
      expect(result.success).toBe(true);
      expect(result.confidence).toBeLessThan(50);
      expect(result.validationErrors).toContain(
        expect.stringMatching(/Multiple destination assets detected/)
      );
      expect(result.requiresConfirmation).toBe(true);
    });

    test('should handle "either" ambiguity', async () => {
      const result = await parseUserCommand('Convert my SOL to either BTC or ETH');
      
      expect(result.confidence).toBeLessThan(50);
      expect(result.requiresConfirmation).toBe(true);
    });
  });

  describe('Typo and Abbreviation Handling', () => {
    test('should handle common typos', async () => {
      const result = await parseUserCommand('swp 1k usdc 2 btc pls');
      
      expect(result.success).toBe(true);
      expect(result.fromAsset).toBe('USDC');
      expect(result.toAsset).toBe('BTC');
      expect(result.amount).toBe(1000);
      expect(result.confidence).toBeGreaterThan(70);
    });

    test('should handle phonetic voice errors', async () => {
      const result = await parseUserCommand('swap won eeth for bit coin');
      
      expect(result.success).toBe(true);
      expect(result.fromAsset).toBe('ETH');
      expect(result.toAsset).toBe('BTC');
      expect(result.amount).toBe(1);
    });

    test('should handle number scaling', async () => {
      const result = await parseUserCommand('swap 5k USDC to BTC');
      
      expect(result.amount).toBe(5000);
      expect(result.fromAsset).toBe('USDC');
      expect(result.toAsset).toBe('BTC');
    });
  });

  describe('Conditional Parsing', () => {
    test('should parse price conditions with scaling', async () => {
      const result = await parseUserCommand('Swap ETH to BTC if price > 60k');
      
      expect(result.intent).toBe('swap');
      expect(result.conditions).toBeDefined();
      expect((result.conditions as any)?.type).toBe('price_above');
      expect((result.conditions as any)?.value).toBe(60000);
      expect(result.requiresConfirmation).toBe(true);
    });

    test('should handle complex conditionals', async () => {
      const result = await parseUserCommand('Swap 50% ETH to BTC only if price above $65000 and market is bullish');
      
      expect(result.amount).toBe(50);
      expect(result.amountType).toBe('percentage');
      expect((result.conditions as any)?.value).toBe(65000);
      expect(result.validationErrors.length).toBeGreaterThan(0); // Should note unsupported condition
    });
  });

  describe('Missing Information Handling', () => {
    test('should identify missing amount', async () => {
      const result = await parseUserCommand('Swap my ETH for BTC');
      
      expect(result.success).toBe(true);
      expect(result.amount).toBeNull();
      expect(result.confidence).toBeLessThan(70);
      expect(result.requiresConfirmation).toBe(true);
      expect(result.validationErrors).toContain(
        expect.stringMatching(/Amount not specified/)
      );
    });

    test('should identify missing destination', async () => {
      const result = await parseUserCommand('Swap 100 ETH');
      
      expect(result.fromAsset).toBe('ETH');
      expect(result.amount).toBe(100);
      expect(result.toAsset).toBeNull();
      expect(result.requiresConfirmation).toBe(true);
    });
  });

  describe('Portfolio Parsing', () => {
    test('should parse equal splits', async () => {
      const result = await parseUserCommand('Split 1000 USDC into BTC, ETH, and SOL equally');
      
      expect(result.intent).toBe('portfolio');
      expect(result.fromAsset).toBe('USDC');
      expect(result.amount).toBe(1000);
      expect(result.portfolio).toHaveLength(3);
      expect((result.portfolio as any)[0].percentage).toBeCloseTo(33.33, 1);
    });
  });

  describe('Contextual Help Generation', () => {
    test('should provide specific help for ambiguous commands', () => {
      const mockAnalysis = {
        intent: 'swap',
        presentFields: [{ field: 'fromAsset', value: 'ETH' }],
        missingFields: ['toAsset'],
        invalidFields: []
      };

      const help = generateContextualHelp(mockAnalysis, 'swap ETH to BTC or USDC', 'text');
      
      expect(help).toContain('multiple options');
      expect(help).toContain('BTC');
      expect(help).toContain('USDC');
    });

    test('should provide voice-specific help', () => {
      const mockAnalysis = {
        intent: 'swap',
        presentFields: [],
        missingFields: ['amount'],
        invalidFields: []
      };

      const help = generateContextualHelp(mockAnalysis, 'swap eth to btc', 'voice');
      
      expect(help).toContain('misheard');
      expect(help).toContain('speaking more clearly');
    });

    test('should provide specific amount guidance', () => {
      const mockAnalysis = {
        intent: 'swap',
        presentFields: [
          { field: 'fromAsset', value: 'ETH' },
          { field: 'toAsset', value: 'BTC' }
        ],
        missingFields: ['amount'],
        invalidFields: []
      };

      const help = generateContextualHelp(mockAnalysis, 'swap ETH to BTC', 'text');
      
      expect(help).toContain('How much ETH');
      expect(help).toContain('exact amount, percentage, or \'all\'');
    });
  });

  describe('Error Recovery', () => {
    test('should handle empty input gracefully', async () => {
      const result = await parseUserCommand('');
      
      expect(result.success).toBe(false);
      expect(result.validationErrors).toContain('Input cannot be empty');
    });

    test('should handle nonsensical input', async () => {
      const result = await parseUserCommand('asdfghjkl qwerty');
      
      expect(result.success).toBe(false);
      expect(result.confidence).toBe(0);
    });
  });

  describe('Confidence Scoring', () => {
    test('should assign high confidence to clear commands', async () => {
      const result = await parseUserCommand('Swap 100 ETH for BTC');
      
      expect(result.confidence).toBeGreaterThan(90);
      expect(result.requiresConfirmation).toBe(false);
    });

    test('should assign low confidence to ambiguous commands', async () => {
      const result = await parseUserCommand('maybe swap some eth');
      
      expect(result.confidence).toBeLessThan(50);
      expect(result.requiresConfirmation).toBe(true);
    });

    test('should assign medium confidence to incomplete commands', async () => {
      const result = await parseUserCommand('swap 1 ETH');
      
      expect(result.confidence).toBeGreaterThan(40);
      expect(result.confidence).toBeLessThan(80);
    });
  });
});