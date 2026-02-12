import { parseUserCommand } from '../src/services/groq-client';

// Mock groq-sdk
jest.mock('groq-sdk', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    success: false,
                    intent: 'unknown',
                    parsedMessage: 'Mock AI response',
                  }),
                },
              },
            ],
          }),
        },
      },
      audio: {
        transcriptions: {
          create: jest.fn().mockResolvedValue({ text: 'mocked audio' }),
        },
      },
    })),
  };
});

describe('parseUserCommand Regex Logic', () => {
  // Case 1: Max/All/Everything
  it('parses "Swap everything to BTC"', async () => {
    const res = await parseUserCommand('Swap everything to BTC');
    expect(res.intent).toBe('swap');
    expect(res.amountType).toBe('all');
    expect(res.toAsset).toBe('BTC');
  });

  it('parses "Swap all ETH to USDT"', async () => {
    const res = await parseUserCommand('Swap all ETH to USDT');
    expect(res.intent).toBe('swap');
    expect(res.amountType).toBe('all');
    expect(res.fromAsset).toBe('ETH');
    expect(res.toAsset).toBe('USDT');
  });

  it('parses "Swap max MATIC"', async () => {
    const res = await parseUserCommand('Swap max MATIC');
    expect(res.intent).toBe('swap');
    expect(res.amountType).toBe('all');
    expect(res.fromAsset).toBe('MATIC');
  });

  // Case 2: Percentage
  it('parses "Swap 50% ETH to USDT"', async () => {
    const res = await parseUserCommand('Swap 50% ETH to USDT');
    expect(res.intent).toBe('swap');
    expect(res.amountType).toBe('percentage');
    expect(res.amount).toBe(50);
    expect(res.fromAsset).toBe('ETH');
    expect(res.toAsset).toBe('USDT');
  });

  it('parses "Swap 25 percent SOL to ETH"', async () => {
    const res = await parseUserCommand('Swap 25 percent SOL to ETH');
    expect(res.intent).toBe('swap');
    expect(res.amountType).toBe('percentage');
    expect(res.amount).toBe(25);
    expect(res.fromAsset).toBe('SOL');
    expect(res.toAsset).toBe('ETH');
  });

  // Case 3: Half
  it('parses "Swap half BTC to SOL"', async () => {
    const res = await parseUserCommand('Swap half BTC to SOL');
    expect(res.intent).toBe('swap');
    expect(res.amountType).toBe('percentage');
    expect(res.amount).toBe(50);
    expect(res.fromAsset).toBe('BTC');
    expect(res.toAsset).toBe('SOL');
  });

  // Case 4: Exclusion
  it('parses "Swap everything except 10 MATIC"', async () => {
    const res = await parseUserCommand('Swap everything except 10 MATIC');
    expect(res.intent).toBe('swap');
    expect(res.amountType).toBe('all');
    // @ts-ignore
    expect(res.excludeAmount).toBe(10);
    expect(res.fromAsset).toBe('MATIC');
  });

  // Case 5: Normal Amount
  it('parses "Convert 100 USDT into BTC"', async () => {
    const res = await parseUserCommand('Convert 100 USDT into BTC');
    expect(res.intent).toBe('swap');
    expect(res.amount).toBe(100);
    expect(res.fromAsset).toBe('USDT');
    expect(res.toAsset).toBe('BTC');
  });

  // Case 6: Send max
  it('parses "Send max BTC"', async () => {
    const res = await parseUserCommand('Send max BTC');
    expect(res.intent).toBe('checkout');
    expect(res.settleAsset).toBe('BTC');
    expect(res.amountType).toBe('all');
  });
});
