import { parseUserCommand } from '../parseUserCommand';
import * as GroqClient from '../groq-client';

jest.mock('../groq-client', () => ({
  parseWithLLM: jest.fn()
}));

describe('parseUserCommand Engine - Edge Cases', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Exclusion & Conditions (Routed to LLM)', () => {
    it('should parse "Swap everything except 10 MATIC" via LLM', async () => {
      (GroqClient.parseWithLLM as jest.Mock).mockResolvedValue({
        intent: 'swap', amountType: 'all', excludeAmount: 10, excludeToken: 'MATIC', confidence: 90
      });

      const result = await parseUserCommand('Swap everything except 10 MATIC');
      expect(result.intent).toBe('swap');
      expect(result.amountType).toBe('all');
      expect(result.excludeAmount).toBe(10);
    });
  });

  describe('Deterministic Fallbacks (Regex / NL Modules)', () => {
    it('should natively capture limit order triggers without LLM', async () => {
      const result = await parseUserCommand('Sell ETH when price drops below $2000');
      expect(result.intent).toBe('limit_order');
      expect(result.fromAsset).toBe('ETH');
      expect(result.targetPrice).toBe(2000);
      expect(result.conditionOperator).toBe('lt');
      expect(GroqClient.parseWithLLM).not.toHaveBeenCalled();
    });

    it('should natively capture DCA timing without LLM', async () => {
      const result = await parseUserCommand('Invest $100 in SOL every week');
      expect(result.intent).toBe('dca');
      expect(result.amount).toBe(100);
      expect(result.toAsset).toBe('SOL');
      expect(result.frequency).toBe('weekly');
      expect(GroqClient.parseWithLLM).not.toHaveBeenCalled();
    });

    it('should extract percentage stakes', async () => {
      const result = await parseUserCommand('Stake 50% USDC');
      expect(result.intent).toBe('stake');
      expect(result.amount).toBe(50);
      expect(result.amountType).toBe('percentage');
      expect(result.fromAsset).toBe('USDC');
    });
  });

  describe('Garbage Handling', () => {
    it('should gracefully degrade to unknown for gibberish via LLM', async () => {
      (GroqClient.parseWithLLM as jest.Mock).mockResolvedValue({
        success: false, intent: 'unknown', confidence: 0, validationErrors: ['Gibberish']
      });

      const result = await parseUserCommand("moon doge coin to the moon wen lambo");
      expect(result.intent).toBe('unknown');
      expect(result.validationErrors).toContain('Gibberish');
    });
  });
});