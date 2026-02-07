import { describe, it, expect, jest } from '@jest/globals';
import { parseUserCommand } from '../services/groq-client';

jest.mock('groq-sdk', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          // Fix: Cast jest.fn() itself to 'any' so it accepts a return value
          create: (jest.fn() as any).mockResolvedValue({
            choices: [{
              message: {
                content: JSON.stringify({
                  success: true,
                  intent: 'swap',
                  fromAsset: 'ETH',
                  fromChain: 'ethereum',
                  toAsset: 'BTC',
                  toChain: 'bitcoin',
                  amount: 1,
                  confidence: 95,
                  validationErrors: [],
                  parsedMessage: 'Swap 1 ETH to BTC'
                })
              }
            }]
          })
        }
      }
    }))
  };
});

describe('parseUserCommand', () => {
  it('should parse a clear swap command', async () => {
    const result = await parseUserCommand('swap 1 ETH to BTC');
    expect(result.success).toBe(true);
    expect(result.intent).toBe('swap');
    expect(result.fromAsset).toBe('ETH');
    expect(result.toAsset).toBe('BTC');
  });

  it('should handle ambiguous command with low confidence', async () => {
    const mockGroq = require('groq-sdk') as any;
    
    mockGroq.default.mockImplementation(() => ({
      chat: {
        completions: {
          // Fix applied here as well
          create: (jest.fn() as any).mockResolvedValue({
            choices: [{
              message: {
                content: JSON.stringify({
                  success: false,
                  intent: 'swap',
                  fromAsset: 'ETH',
                  toAsset: null,
                  confidence: 20,
                  validationErrors: ['Command is ambiguous.'],
                  parsedMessage: ''
                })
              }
            }]
          })
        }
      }
    }));

    const result = await parseUserCommand('swap 1 ETH to BTC or USDC');
    expect(result.success).toBe(false);
    expect(result.confidence).toBeLessThan(50);
  });

  it('should parse portfolio allocation correctly', async () => {
    const mockGroq = require('groq-sdk') as any;
    mockGroq.default.mockImplementation(() => ({
      chat: {
        completions: {
          // Fix applied here as well
          create: (jest.fn() as any).mockResolvedValue({
            choices: [{
              message: {
                content: JSON.stringify({
                  success: true,
                  intent: 'portfolio',
                  fromAsset: 'ETH',
                  fromChain: 'base',
                  amount: 1,
                  portfolio: [
                    { toAsset: 'USDC', toChain: 'arbitrum', percentage: 50 },
                    { toAsset: 'SOL', toChain: 'solana', percentage: 50 }
                  ],
                  confidence: 95,
                  validationErrors: [],
                  parsedMessage: 'Split 1 ETH'
                })
              }
            }]
          })
        }
      }
    }));

    const result = await parseUserCommand('split 1 ETH');
    expect(result.success).toBe(true);
    expect(result.intent).toBe('portfolio');
    expect(result.portfolio).toHaveLength(2);
  });
});