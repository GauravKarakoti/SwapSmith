// Helper to mock environment variables if needed
process.env.GROQ_API_KEY = 'dummy-key'; 

jest.mock('../groq-client', () => ({
    ParsedCommand: {},
    parseWithLLM: jest.fn(),
}));

import { parseUserCommand } from '../parseUserCommand';

describe('Limit Order Parsing', () => {
    it('should detect limit order intent with "drops below"', async () => {
        const result = await parseUserCommand('Swap 100 USDC to ETH when ETH drops below 2000');
        // Success check
        expect(result.success).toBe(true);
        
        // Only verify fields if success is true to avoid TS errors
        if ('intent' in result) {
            expect(result.intent).toBe('limit_order');
            expect(result.fromAsset).toBe('USDC');
            expect(result.toAsset).toBe('ETH');
            expect(result.amount).toBe(100);
            expect(result.conditions).toBeDefined();
            expect(result.conditions?.type).toBe('price_below');
            expect(result.conditions?.value).toBe(2000);
        }
    });

    it('should detect limit order intent with "rises above"', async () => {
        const result = await parseUserCommand('Convert 1 ETH to USDC if price goes above 3000');
        expect(result.success).toBe(true);
        if ('intent' in result) {
            expect(result.intent).toBe('limit_order');
            expect(result.fromAsset).toBe('ETH');
            expect(result.conditions?.type).toBe('price_above');
            expect(result.conditions?.value).toBe(3000);
        }
    });

    it('should detect "greater than"', async () => {
        const result = await parseUserCommand('Swap ETH to USDC when price > 4000');
        if ('intent' in result) {
             expect(result.intent).toBe('limit_order');
             expect(result.conditions?.type).toBe('price_above');
             expect(result.conditions?.value).toBe(4000);
        }
    });
});
