import { describe, it, expect, jest, beforeEach } from '@jest/globals';

const mockCreate = jest.fn() as any;

jest.mock('groq-sdk', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: mockCreate
        }
      },
      audio: {
        transcriptions: {
          create: jest.fn()
        }
      }
    }))
  };
});

describe('parseUserCommand', () => {
  let parseUserCommand: any;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    // Re-require the module to ensure fresh mock injection if needed,
    // though using a shared mockCreate spy is easier.
    parseUserCommand = require('../services/groq-client').parseWithLLM;
  });

  it('should parse a clear swap command', async () => {
    mockCreate.mockResolvedValueOnce({
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
    });

    const result = await parseUserCommand('swap 1 ETH to BTC');
    expect(result.success).toBe(true);
    expect(result.intent).toBe('swap');
    expect(result.fromAsset).toBe('ETH');
    expect(result.toAsset).toBe('BTC');
  });

  it('should handle ambiguous command with low confidence', async () => {
    mockCreate.mockResolvedValueOnce({
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
    });

    const result = await parseUserCommand('swap 1 ETH to BTC or USDC');
    expect(result.success).toBe(false);
    expect(result.confidence).toBeLessThan(50);
  });

  it('should parse portfolio allocation correctly', async () => {
    mockCreate.mockResolvedValueOnce({
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
    });

    const result = await parseUserCommand('split 1 ETH');
    expect(result.success).toBe(true);
    expect(result.intent).toBe('portfolio');
    expect(result.portfolio).toHaveLength(2);
  });
});