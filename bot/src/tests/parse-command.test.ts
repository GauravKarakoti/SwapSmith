import { parseUserCommand } from '../services/groq-client';
import Groq from 'groq-sdk';


// Mock the groq-sdk module
jest.mock('groq-sdk', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(function (this: any) {
      this.chat = {
        completions: {
          create: jest.fn().mockResolvedValue({
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
      };
    })
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
    const mockGroq = Groq as unknown as jest.Mock;

    const mockCreate = mockGroq.mock.instances[0].chat.completions.create;
    mockCreate.mockResolvedValue({
      choices: [{
        message: {
          content: JSON.stringify({
            success: false,
            intent: 'swap',
            fromAsset: 'ETH',
            toAsset: null,
            confidence: 20,
            validationErrors: ['Command is ambiguous. Please specify clearly.'],
            parsedMessage: ''
          })
        }
      }]
    });

    const result = await parseUserCommand('swap 1 ETH to BTC or USDC');
    expect(result.success).toBe(false);
    expect(result.confidence).toBeLessThan(50);
    expect(result.validationErrors).toContain('Low confidence in parsing. Please rephrase your command for clarity.');
  });

  it('should parse portfolio allocation correctly', async () => {
    const mockGroq = Groq as unknown as jest.Mock;
    const mockCreate = mockGroq.mock.instances[0].chat.completions.create;
    mockCreate.mockResolvedValue({
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
            parsedMessage: 'Split 1 ETH into 50% USDC and 50% SOL'
          })
        }
      }]
    });

    const result = await parseUserCommand('split 1 ETH into 50% USDC and 50% SOL');
    expect(result.success).toBe(true);
    expect(result.intent).toBe('portfolio');
    expect(result.portfolio).toHaveLength(2);
  });

  it('should validate portfolio percentages', async () => {
    const mockGroq = Groq as unknown as jest.Mock;
    const mockCreate = mockGroq.mock.instances[0].chat.completions.create;
    mockCreate.mockResolvedValue({
      choices: [{
        message: {
          content: JSON.stringify({
            success: true,
            intent: 'portfolio',
            fromAsset: 'ETH',
            amount: 1,
            portfolio: [
              { toAsset: 'BTC', toChain: 'bitcoin', percentage: 60 },
              { toAsset: 'USDC', toChain: 'ethereum', percentage: 50 }
            ],
            confidence: 80,
            validationErrors: [],
            parsedMessage: 'Invalid portfolio'
          })
        }
      }]
    });

    const result = await parseUserCommand('split 1 ETH into 60% BTC and 50% USDC');
    expect(result.success).toBe(false);
    expect(result.validationErrors).toContain('Total allocation is 110%, but should be 100%');
  });

  it('should handle yield scout intent', async () => {
    const mockGroq = Groq as unknown as jest.Mock;
    const mockCreate = mockGroq.mock.instances[0].chat.completions.create;
    mockCreate.mockResolvedValue({
      choices: [{
        message: {
          content: JSON.stringify({
            success: true,
            intent: 'yield_scout',
            confidence: 100,
            validationErrors: [],
            parsedMessage: 'Looking for yield opportunities'
          })
        }
      }]
    });

    const result = await parseUserCommand('where can I get good yield?');
    expect(result.success).toBe(true);
    expect(result.intent).toBe('yield_scout');
  });

  it('should handle yield deposit intent', async () => {
    const mockGroq = Groq as unknown as jest.Mock;
    const mockCreate = mockGroq.mock.instances[0].chat.completions.create;
    mockCreate.mockResolvedValue({
      choices: [{
        message: {
          content: JSON.stringify({
            success: true,
            intent: 'yield_deposit',
            fromAsset: 'ETH',
            amount: 1,
            confidence: 95,
            validationErrors: [],
            parsedMessage: 'Depositing 1 ETH to yield'
          })
        }
      }]
    });

    const result = await parseUserCommand('deposit 1 ETH to yield');
    expect(result.success).toBe(true);
    expect(result.intent).toBe('yield_deposit');
    expect(result.fromAsset).toBe('ETH');
    expect(result.amount).toBe(1);
  });
});
