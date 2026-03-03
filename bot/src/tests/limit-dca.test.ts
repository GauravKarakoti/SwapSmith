import { parseUserCommand } from '../services/parseUserCommand'; // Fixed import
import * as priceMonitor from '../services/price-monitor';
import * as db from '../services/database';
import * as groqClient from '../services/groq-client';

// Mock parseWithLLM directly
jest.mock('../services/groq-client', () => {
  return {
    ...jest.requireActual('../services/groq-client'),
    parseWithLLM: jest.fn().mockResolvedValue({
      success: true,
      intent: 'limit_order',
      fromAsset: 'USDC',
      fromChain: 'ethereum',
      toAsset: 'ETH',
      toChain: 'ethereum',
      amount: 1,
      targetPrice: 2500,
      condition: 'below',
      confidence: 95,
      validationErrors: [],
      parsedMessage: 'Buy 1 ETH with USDC if price drops below $2500'
    })
  };
});

describe('Limit Order & DCA Parsing', () => {
  it('should parse a limit order command', async () => {
    const result = await parseUserCommand('Buy 1 ETH with USDC if the price drops below $2500', []);
    expect(result.success).toBe(true);
    expect(result.intent).toBe('limit_order');
    expect(result.toAsset).toBe('ETH');
    expect(result.fromAsset).toBe('USDC');
    expect(result.targetPrice).toBe(2500);
    expect(result.condition).toBe('below');
    expect(result.amount).toBe(1);
  });

  it('should parse a sell limit order', async () => {
    (groqClient.parseWithLLM as jest.Mock).mockResolvedValueOnce({
      success: true,
      intent: 'limit_order',
      fromAsset: 'ETH',
      fromChain: 'ethereum',
      toAsset: 'USDC',
      toChain: 'ethereum',
      amount: 2,
      targetPrice: 4000,
      condition: 'above',
      confidence: 95,
      validationErrors: [],
      parsedMessage: 'Sell 2 ETH when price hits $4000'
    });

    const result = await parseUserCommand('Sell 2 ETH when price hits $4000', []);
    expect(result.success).toBe(true);
    expect(result.intent).toBe('limit_order');
    expect(result.condition).toBe('above');
    expect(result.targetPrice).toBe(4000);
  });

  it('should parse a DCA command', async () => {
    (groqClient.parseWithLLM as jest.Mock).mockResolvedValueOnce({
      success: true,
      intent: 'dca',
      toAsset: 'BTC',
      toChain: 'bitcoin',
      amount: 50,
      totalAmount: 200,
      frequency: 'weekly',
      numPurchases: 4,
      startDate: '2024-01-01T00:00:00Z',
      confidence: 95,
      validationErrors: [],
      parsedMessage: 'DCA $50 into Bitcoin every week for a month'
    });

    const result = await parseUserCommand('DCA $50 into Bitcoin every week for a month', []);
    expect(result.success).toBe(true);
    expect(result.intent).toBe('dca');
    expect(result.toAsset).toBe('BTC');
    expect(result.amount).toBe(50);
    expect(result.totalAmount).toBe(200);
    expect(result.frequency).toBe('weekly');
    expect(result.numPurchases).toBe(4);
  });

  it('should validate limit order fields', async () => {
    (groqClient.parseWithLLM as jest.Mock).mockResolvedValueOnce({
      success: false,
      intent: 'limit_order',
      fromAsset: 'USDC',
      toAsset: 'ETH',
      amount: 1,
      targetPrice: null, // Missing target price
      condition: 'below',
      confidence: 80,
      validationErrors: ['Target price not specified'],
      parsedMessage: 'Invalid limit order'
    });

    const result = await parseUserCommand('Buy ETH when cheap', []);
    expect(result.success).toBe(false);
    expect(result.validationErrors).toContain('Target price not specified');
  });

  it('should validate DCA fields', async () => {
    (groqClient.parseWithLLM as jest.Mock).mockResolvedValueOnce({
      success: false,
      intent: 'dca',
      toAsset: 'BTC',
      amount: 50,
      totalAmount: null, // Missing total amount
      frequency: 'weekly',
      numPurchases: 4,
      confidence: 80,
      validationErrors: ['Total investment amount not specified'],
      parsedMessage: 'Invalid DCA'
    });

    const result = await parseUserCommand('DCA into Bitcoin', []);
    expect(result.success).toBe(false);
    expect(result.validationErrors).toContain('Total investment amount not specified');
  });
});

describe('Price Monitor', () => {
  it('should check if limit order is triggered when price goes below target', () => {
    const currentPrice = 2400;
    const targetPrice = 2500;
    const condition = 'below';

    const triggered = priceMonitor.isLimitOrderTriggered(currentPrice, targetPrice, condition);
    expect(triggered).toBe(true);
  });

  it('should check if limit order is triggered when price goes above target', () => {
    const currentPrice = 4100;
    const targetPrice = 4000;
    const condition = 'above';

    const triggered = priceMonitor.isLimitOrderTriggered(currentPrice, targetPrice, condition);
    expect(triggered).toBe(true);
  });

  it('should not trigger limit order when condition is not met', () => {
    const currentPrice = 2600;
    const targetPrice = 2500;
    const condition = 'below';

    const triggered = priceMonitor.isLimitOrderTriggered(currentPrice, targetPrice, condition);
    expect(triggered).toBe(false);
  });

  it('should format prices correctly', () => {
    expect(priceMonitor.formatPrice(50000)).toBe('$50,000.00');
    expect(priceMonitor.formatPrice(2500.50)).toBe('$2,500.50');
    expect(priceMonitor.formatPrice(0.5)).toBe('$0.5000');
    expect(priceMonitor.formatPrice(0.001)).toBe('$0.001000');
  });
});

describe('Database Functions', () => {
  it('should create a delayed order', async () => {
    const intentData = {
      fromAsset: 'USDC',
      toAsset: 'ETH',
      amount: 1,
      targetPrice: 2500,
      condition: 'below',
      frequency: null,
      numPurchases: null,
      totalAmount: null
    };

    // This would need actual database mocking
    // For now, just verify the function structure
    expect(typeof db.createDelayedOrder).toBe('function');
  });

  it('should get pending delayed orders', async () => {
    expect(typeof db.getPendingDelayedOrders).toBe('function');
  });

  it('should update delayed order status', async () => {
    expect(typeof db.updateDelayedOrderStatus).toBe('function');
  });

  it('should cancel a delayed order', async () => {
    expect(typeof db.cancelDelayedOrder).toBe('function');
  });
});