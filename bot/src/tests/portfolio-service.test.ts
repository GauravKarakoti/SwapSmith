import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { executePortfolioStrategy } from '../services/portfolio-service';

jest.mock('../services/sideshift-client', () => ({
  createQuote: jest.fn(),
  createOrder: jest.fn(),
}));

jest.mock('../services/database', () => ({
  db: {
    transaction: jest.fn((callback: any) => callback({
      insert: jest.fn().mockReturnValue({
        values: jest.fn().mockReturnValue({
          onConflictDoNothing: jest.fn()
        })
      })
    }))
  },
  orders: {},
  watchedOrders: {}
}));

jest.mock('../services/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    error: jest.fn(),
  }
}));

const mockCreateQuote = require('../services/sideshift-client').createQuote;
const mockCreateOrder = require('../services/sideshift-client').createOrder;
const mockDb = require('../services/database');

describe('executePortfolioStrategy', () => {
  const userId = 12345;
  const validCommand: any = {
    fromAsset: 'USDC',
    fromChain: 'ethereum',
    amount: 1000,
    settleAddress: '0xAddress',
    portfolio: [
      { toAsset: 'ETH', toChain: 'ethereum', percentage: 50 },
      { toAsset: 'BTC', toChain: 'bitcoin', percentage: 50 }
    ]
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateQuote.mockResolvedValue({
      id: 'quote_123',
      settleAmount: '0.5'
    });
    mockCreateOrder.mockResolvedValue({
      id: 'order_123',
      depositAddress: '0xDeposit'
    });
  });

  it('should execute a valid portfolio strategy successfully', async () => {
    const result = await executePortfolioStrategy(userId, validCommand);

    expect(result.successfulOrders).toHaveLength(2);
    expect(result.failedSwaps).toHaveLength(0);

    expect(mockCreateQuote).toHaveBeenCalledTimes(2);
    expect(mockCreateOrder).toHaveBeenCalledTimes(2);
    expect(mockDb.db.transaction).toHaveBeenCalledTimes(1);
  });

  it('should rollback on failure (all-or-nothing)', async () => {
    mockCreateQuote
      .mockResolvedValueOnce({ id: 'quote_1', settleAmount: '0.5' })
      .mockRejectedValueOnce(new Error('Liquidity Error'));

    await expect(executePortfolioStrategy(userId, validCommand))
      .rejects.toThrow('Liquidity Error');

    expect(mockDb.db.transaction).not.toHaveBeenCalled();
  });

  it('should validate empty portfolio', async () => {
    const invalidCommand = { ...validCommand, portfolio: [] };
    await expect(executePortfolioStrategy(userId, invalidCommand))
      .rejects.toThrow('No portfolio allocation found');
  });

  it('should handle remainder correctly', async () => {
    const splitCommand = {
      ...validCommand,
      amount: 100,
      portfolio: [
        { toAsset: 'A', toChain: 'ethereum', percentage: 33.333 },
        { toAsset: 'B', toChain: 'ethereum', percentage: 33.333 },
        { toAsset: 'C', toChain: 'ethereum', percentage: 33.334 }
      ]
    };

    await executePortfolioStrategy(userId, splitCommand);

    const calls = mockCreateQuote.mock.calls;
    const amount1 = calls[0][4];
    const amount2 = calls[1][4];
    const amount3 = calls[2][4];

    expect(amount1).toBeCloseTo(33.333, 3);
    expect(amount2).toBeCloseTo(33.333, 3);
    expect(amount3).toBeCloseTo(33.334, 3);
    expect(amount1 + amount2 + amount3).toBeCloseTo(100, 5);
  });
});
