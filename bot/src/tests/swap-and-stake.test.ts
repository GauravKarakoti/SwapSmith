import { parseUserCommand } from '../services/parseUserCommand';
import { getZapQuote, formatZapQuote } from '../services/stake-client';
import { getDepositAddress, getProtocolInfo, enrichPoolWithDepositAddress, YIELD_PROTOCOLS } from '../services/yield-client';

describe('Swap and Stake Enhancement', () => {

  describe('parseUserCommand - swap_and_stake intent detection', () => {

    test('should detect "swap and stake" command', async () => {
      const result = await parseUserCommand('swap and stake 100 ETH to USDC');

      expect(result.success).toBe(true);
      expect(result.intent).toBe('swap_and_stake');
      expect(result.amount).toBe(100);
      expect(result.fromAsset).toBe('ETH');
      expect(result.toAsset).toBe('USDC');
      expect(result.confidence).toBe(80);
    });

    test('should detect "zap into" command', async () => {
      const result = await parseUserCommand('zap 50 ETH into USDC');

      expect(result.success).toBe(true);
      expect(result.intent).toBe('swap_and_stake');
      expect(result.amount).toBe(50);
      expect(result.fromAsset).toBe('ETH');
      expect(result.toAsset).toBe('USDC');
    });

    test('should detect protocol in command', async () => {
      const result = await parseUserCommand('swap and stake 100 ETH to USDC on aave');

      expect(result.success).toBe(true);
      expect(result.intent).toBe('swap_and_stake');
      expect(result.fromProject).toBe('aave');
      expect(result.toProject).toBe('aave');
    });

    test('should default to USDC when no target asset specified', async () => {
      const result = await parseUserCommand('swap and stake my ETH');

      expect(result.success).toBe(true);
      expect(result.intent).toBe('swap_and_stake');
      expect(result.toAsset).toBe('USDC');
    });

    test('should require confirmation for swap and stake', async () => {
      const result = await parseUserCommand('swap and stake 100 ETH to USDC');

      expect(result.requiresConfirmation).toBe(true);
    });

  });

  describe('yield-client - deposit address functions', () => {

    test('should have YIELD_PROTOCOLS defined', () => {
      expect(YIELD_PROTOCOLS.length).toBeGreaterThan(0);
    });

    test('should get deposit address for Aave V3 on Ethereum', () => {
      const mockPool = {
        chain: 'Ethereum',
        project: 'aave-v3',
        symbol: 'USDC',
        apy: 5.0,
        tvlUsd: 1000000
      };

      const depositAddress = getDepositAddress(mockPool);
      expect(depositAddress).toBeTruthy();
      expect(depositAddress).toMatch(/^0x[a-fA-F0-9]{40}$/);
    });

    test('should get protocol info for yield pool', () => {
      const mockPool = {
        chain: 'Ethereum',
        project: 'aave-v3',
        symbol: 'USDC',
        apy: 5.0,
        tvlUsd: 1000000
      };

      const protocol = getProtocolInfo(mockPool);
      expect(protocol).toBeTruthy();
      expect(protocol?.name).toBe('Aave V3');
      expect(protocol?.rewardToken).toBe('AAVE');
    });

    test('should enrich pool with deposit address', () => {
      const mockPool = {
        chain: 'Ethereum',
        project: 'aave-v3',
        symbol: 'USDC',
        apy: 5.0,
        tvlUsd: 1000000
      };

      const enriched = enrichPoolWithDepositAddress(mockPool);
      expect(enriched.depositAddress).toBeTruthy();
      expect(enriched.rewardToken).toBe('AAVE');
      expect(enriched.underlyingToken).toBe('USDC');
    });

    test('should return null for unknown protocol', () => {
      const mockPool = {
        chain: 'Ethereum',
        project: 'unknown-protocol',
        symbol: 'USDC',
        apy: 5.0,
        tvlUsd: 1000000
      };

      const depositAddress = getDepositAddress(mockPool);
      expect(depositAddress).toBeNull();
    });

  });

  describe('stake-client - zap functions', () => {

    test('should have getZapQuote function', () => {
      expect(typeof getZapQuote).toBe('function');
    });

    test('should have formatZapQuote function', () => {
      expect(typeof formatZapQuote).toBe('function');
    });

    test('formatZapQuote should format correctly', () => {
      const mockZapQuote = {
        fromAsset: 'ETH',
        fromNetwork: 'ethereum',
        toAsset: 'USDC',
        toNetwork: 'ethereum',
        fromAmount: '1',
        expectedReceive: '3000',
        stakePool: {
          chain: 'Ethereum',
          project: 'aave-v3',
          symbol: 'USDC',
          apy: 5.0,
          tvlUsd: 1000000,
          depositAddress: '0x87870Bca3F3f6335e32cdC2d17F6b8d2c2A3eE1'
        },
        estimatedApy: 5.0,
        estimatedAnnualYield: '150',
        depositAddress: '0x87870Bca3F3f6335e32cdC2d17F6b8d2c2A3eE1',
        protocolName: 'Aave V3',
        steps: [
          { step: 1, action: 'swap' as const, description: 'Swap 1 ETH to USDC', status: 'ready' as const },
          { step: 2, action: 'stake' as const, description: 'Deposit USDC to Aave V3', status: 'pending' as const }
        ]
      };


      const formatted = formatZapQuote(mockZapQuote);
      expect(formatted).toContain('Swap & Stake Quote');
      expect(formatted).toContain('ETH');
      expect(formatted).toContain('USDC');
      expect(formatted).toContain('Aave V3');
      expect(formatted).toContain('5.00%');
    });

  });

});
