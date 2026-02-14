import { parseUserCommand } from '../services/parseUserCommand';
import { limitOrderWorker } from '../workers/limitOrderWorker';
import { db, updateLimitOrderStatus } from '../services/database';
import axios from 'axios';
import { createQuote, createOrder } from '../services/sideshift-client';

// Mock Groq SDK to avoid API key requirement
jest.mock('groq-sdk', () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn(),
      },
    },
  }));
});

// Mock dependencies
jest.mock('axios');
jest.mock('../services/database', () => ({
  db: {
    select: jest.fn(),
    update: jest.fn(),
    insert: jest.fn(),
  },
  limitOrders: {
    status: 'status',
    id: 'id',
    conditionAsset: 'conditionAsset'
  },
  getUser: jest.fn(),
  updateLimitOrderStatus: jest.fn(),
  eq: jest.fn(),
  and: jest.fn(),
}));

jest.mock('../services/sideshift-client', () => ({
  getCoins: jest.fn().mockResolvedValue([
    { coin: 'BTC', name: 'Bitcoin' },
    { coin: 'ETH', name: 'Ethereum' }
  ]),
  createQuote: jest.fn(),
  createOrder: jest.fn(),
}));

describe('Limit Order Feature', () => {

  describe('Parser Logic', () => {
    it('should parse exact condition: if BTC > 50000', async () => {
      const result = await parseUserCommand('Swap 1 ETH to USDC if BTC > 50000');
      expect(result.intent).toBe('swap');
      expect(result.conditionAsset).toBe('BTC');
      expect(result.conditionOperator).toBe('gt');
      expect(result.conditionValue).toBe(50000);
    });

    it('should parse implicit asset condition: if price goes above 3000', async () => {
      const result = await parseUserCommand('Swap ETH to USDC if price goes above 3000');
      expect(result.intent).toBe('swap');
      expect(result.fromAsset).toBe('ETH');
      expect(result.conditionAsset).toBe('ETH'); // Defaults to fromAsset
      expect(result.conditionOperator).toBe('gt');
      expect(result.conditionValue).toBe(3000);
    });

    it('should parse drop condition: when SOL drops below 20', async () => {
      const result = await parseUserCommand('Sell SOL for USDC when SOL drops below 20');
      expect(result.intent).toBe('swap');
      expect(result.fromAsset).toBe('SOL');
      expect(result.conditionAsset).toBe('SOL');
      expect(result.conditionOperator).toBe('lt');
      expect(result.conditionValue).toBe(20);
    });

    it('should parse symbol less condition: if < 2000', async () => {
       const result = await parseUserCommand('Swap ETH to USDC if < 2000');
       expect(result.conditionOperator).toBe('lt');
       expect(result.conditionValue).toBe(2000);
       expect(result.conditionAsset).toBe('ETH');
    });
  });

});
