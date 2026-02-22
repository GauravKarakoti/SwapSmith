import { parseUserCommand } from '../services/parseUserCommand';

// Mock Groq to avoid API calls and force deterministic path or control fallback
jest.mock('groq-sdk', () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockRejectedValue(new Error("LLM Disabled for Test")),
      },
    },
  }));
});

describe('Conditional Parsing & Percentage', () => {

    // Test 1: Percentage
    test('should parse percentage amount', async () => {
        const result = await parseUserCommand('Swap 50% of my ETH for BTC');
        expect(result.amount).toBe(50);
        expect(result.amountType).toBe('percentage');
        expect(result.fromAsset).toBe('ETH');
        expect(result.toAsset).toBe('BTC');
    });

    // Test 2: Conditional with k suffix (Deterministic Path via updated REGEX_CONDITION)
    test('should parse conditional with k suffix', async () => {
        const result = await parseUserCommand('Swap ETH to BTC if price > 60k');
        expect(result.intent).toBe('swap');
        expect(result.conditions).toBeDefined();
        expect(result.conditions?.type).toBe('price_above');
        expect(result.conditions?.value).toBe(60000);
    });

    // Test 3: Conditional with m suffix
    test('should parse conditional with m suffix', async () => {
        const result = await parseUserCommand('Swap ETH to BTC when price below 1.2m');
        expect(result.conditions?.type).toBe('price_below');
        expect(result.conditions?.value).toBe(1200000);
    });

    // Test 4: Complex sentence
    test('should parse complex conditional sentence', async () => {
        const result = await parseUserCommand('Swap 50% of my ETH for BTC only if price is above 60k');
        expect(result.amount).toBe(50);
        expect(result.amountType).toBe('percentage');
        expect(result.conditions?.type).toBe('price_above');
        expect(result.conditions?.value).toBe(60000);
    });

    // Test 5: Conditional with $ prefix (Deterministic Path)
    test('should parse conditional with $ prefix', async () => {
        const result = await parseUserCommand('Swap ETH to BTC if price > $60k');
        expect(result.conditions?.type).toBe('price_above');
        expect(result.conditions?.value).toBe(60000);
    });

});
