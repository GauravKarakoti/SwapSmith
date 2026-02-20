import { parseUserCommand } from '../services/parseUserCommand';
import { 
  findBestStakingProtocol, 
  createSwapAndStakeOrder, 
  getSupportedProtocolsForAsset,
  formatStakingInfo,
  StakingProtocol 
} from '../services/stake-client';
import { getTopYieldPools } from '../services/yield-client';

// Mock the yield-client
jest.mock('../services/yield-client');
jest.mock('../services/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

describe('Swap and Stake - Intent Parsing', () => {
  test('should detect "stake" keyword and set swap_and_stake intent', async () => {
    const result = await parseUserCommand('Swap 100 USDC for ETH and stake it immediately');
    
    expect(result.success).toBe(true);
    expect(result.intent).toBe('swap_and_stake');
    expect(result.fromAsset).toBe('USDC');
    expect(result.toAsset).toBe('ETH');
    expect(result.amount).toBe(100);
    expect(result.stakeImmediately).toBe(true);
  });

  test('should detect "staking" keyword', async () => {
    const result = await parseUserCommand('Convert 50 ETH to USDC and start staking');
    
    expect(result.success).toBe(true);
    expect(result.intent).toBe('swap_and_stake');
    expect(result.fromAsset).toBe('ETH');
    expect(result.toAsset).toBe('USDC');
    expect(result.amount).toBe(50);
  });

  test('should detect "earn yield" keyword', async () => {
    const result = await parseUserCommand('Swap all my BTC to ETH and earn yield');
    
    expect(result.success).toBe(true);
    expect(result.intent).toBe('swap_and_stake');
    expect(result.fromAsset).toBe('BTC');
    expect(result.toAsset).toBe('ETH');
    expect(result.amountType).toBe('all');
  });

  test('should detect "farm" keyword', async () => {
    const result = await parseUserCommand('Swap 1000 USDC to DAI and farm');
    
    expect(result.success).toBe(true);
    expect(result.intent).toBe('swap_and_stake');
    expect(result.fromAsset).toBe('USDC');
    expect(result.toAsset).toBe('DAI');
    expect(result.amount).toBe(1000);
  });

  test('should extract staking protocol - Aave', async () => {
    const result = await parseUserCommand('Swap 100 ETH to USDC and stake on Aave');
    
    expect(result.success).toBe(true);
    expect(result.intent).toBe('swap_and_stake');
    expect(result.stakingProtocol).toBe('Aave');
    expect(result.fromAsset).toBe('ETH');
    expect(result.toAsset).toBe('USDC');
  });

  test('should extract staking protocol - Compound', async () => {
    const result = await parseUserCommand('Swap 50 USDC for DAI and stake with Compound');
    
    expect(result.success).toBe(true);
    expect(result.intent).toBe('swap_and_stake');
    expect(result.stakingProtocol).toBe('Compound');
  });

  test('should extract staking protocol - via syntax', async () => {
    const result = await parseUserCommand('Swap 200 USDT to USDC and stake via Curve');
    
    expect(result.success).toBe(true);
    expect(result.intent).toBe('swap_and_stake');
    expect(result.stakingProtocol).toBe('Curve');
  });

  test('should handle percentage amounts with staking', async () => {
    const result = await parseUserCommand('Swap 50% of my ETH to USDC and stake it');
    
    expect(result.success).toBe(true);
    expect(result.intent).toBe('swap_and_stake');
    expect(result.amountType).toBe('percentage');
    expect(result.amount).toBe(50);
  });

  test('should handle "all" amount with staking', async () => {
    const result = await parseUserCommand('Swap all my USDC to ETH and stake immediately');
    
    expect(result.success).toBe(true);
    expect(result.intent).toBe('swap_and_stake');
    expect(result.amountType).toBe('all');
    expect(result.fromAsset).toBe('USDC');
  });

  test('should not affect regular swap commands', async () => {
    const result = await parseUserCommand('Swap 100 ETH for BTC');
    
    expect(result.success).toBe(true);
    expect(result.intent).toBe('swap');
    expect(result.stakeImmediately).toBeUndefined();
  });

  test('should handle complex command with chain specification', async () => {
    const result = await parseUserCommand('Swap 100 USDC on Ethereum to ETH on Arbitrum and stake on Aave');
    
    expect(result.success).toBe(true);
    expect(result.intent).toBe('swap_and_stake');
    expect(result.fromAsset).toBe('USDC');
    expect(result.toAsset).toBe('ETH');
    expect(result.stakingProtocol).toBe('Aave');
  });

  test('should handle "deposit to yield" keyword', async () => {
    const result = await parseUserCommand('Swap 500 DAI to USDC and deposit to yield');
    
    expect(result.success).toBe(true);
    expect(result.intent).toBe('swap_and_stake');
    expect(result.fromAsset).toBe('DAI');
    expect(result.toAsset).toBe('USDC');
  });

  test('should handle "pool" keyword', async () => {
    const result = await parseUserCommand('Swap 1000 USDC to ETH and add to pool');
    
    expect(result.success).toBe(true);
    expect(result.intent).toBe('swap_and_stake');
  });
});

describe('Swap and Stake - Stake Client', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('findBestStakingProtocol should return protocol for supported asset', async () => {
    const mockPools = [
      {
        chain: 'ethereum',
        project: 'Aave',
        symbol: 'USDC',
        apy: 5.5,
        tvlUsd: 100000000,
        poolId: 'aave-usdc'
      },
      {
        chain: 'ethereum',
        project: 'Compound',
        symbol: 'USDC',
        apy: 4.8,
        tvlUsd: 80000000,
        poolId: 'compound-usdc'
      }
    ];

    (getTopYieldPools as jest.Mock).mockResolvedValue(mockPools);

    const protocol = await findBestStakingProtocol('USDC', 'ethereum');
    
    expect(protocol).not.toBeNull();
    expect(protocol?.name).toBe('Aave');
    expect(protocol?.apy).toBe(5.5);
    expect(protocol?.supportedAssets).toContain('USDC');
  });

  test('findBestStakingProtocol should return requested protocol if supported', async () => {
    const mockPools = [
      {
        chain: 'ethereum',
        project: 'Compound',
        symbol: 'USDC',
        apy: 4.8,
        tvlUsd: 80000000,
        poolId: 'compound-usdc'
      }
    ];

    (getTopYieldPools as jest.Mock).mockResolvedValue(mockPools);

    const protocol = await findBestStakingProtocol('USDC', 'ethereum', 'Compound');
    
    expect(protocol).not.toBeNull();
    expect(protocol?.name).toBe('Compound');
  });

  test('findBestStakingProtocol should return null for unsupported asset', async () => {
    (getTopYieldPools as jest.Mock).mockResolvedValue([]);

    const protocol = await findBestStakingProtocol('UNKNOWN', 'ethereum');
    
    expect(protocol).toBeNull();
  });

  test('createSwapAndStakeOrder should create order successfully', async () => {
    const mockPools = [
      {
        chain: 'ethereum',
        project: 'Aave',
        symbol: 'ETH',
        apy: 3.5,
        tvlUsd: 500000000,
        poolId: 'aave-eth'
      }
    ];

    (getTopYieldPools as jest.Mock).mockResolvedValue(mockPools);

    const result = await createSwapAndStakeOrder({
      fromAsset: 'USDC',
      fromChain: 'ethereum',
      toAsset: 'ETH',
      toChain: 'ethereum',
      amount: 1000,
      stakerAddress: '0x1234567890abcdef'
    });

    expect(result.success).toBe(true);
    expect(result.orderId).toBeDefined();
    expect(result.estimatedApy).toBe(3.5);
    expect(result.stakingProtocol).toBe('Aave');
  });

  test('createSwapAndStakeOrder should return error if no protocol found', async () => {
    (getTopYieldPools as jest.Mock).mockResolvedValue([]);

    const result = await createSwapAndStakeOrder({
      fromAsset: 'USDC',
      fromChain: 'ethereum',
      toAsset: 'UNKNOWN',
      toChain: 'ethereum',
      amount: 1000,
      stakerAddress: '0x1234567890abcdef'
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('No staking protocol found');
  });

  test('createSwapAndStakeOrder should use specified protocol', async () => {
    const mockPools = [
      {
        chain: 'ethereum',
        project: 'Lido',
        symbol: 'ETH',
        apy: 4.2,
        tvlUsd: 1000000000,
        poolId: 'lido-eth'
      }
    ];

    (getTopYieldPools as jest.Mock).mockResolvedValue(mockPools);

    const result = await createSwapAndStakeOrder({
      fromAsset: 'USDC',
      fromChain: 'ethereum',
      toAsset: 'ETH',
      toChain: 'ethereum',
      amount: 100,
      stakingProtocol: 'Lido',
      stakerAddress: '0x1234567890abcdef'
    });

    expect(result.success).toBe(true);
    expect(result.stakingProtocol).toBe('Lido');
  });

  test('getSupportedProtocolsForAsset should return correct protocols', () => {
    const protocols = getSupportedProtocolsForAsset('ETH');
    
    expect(protocols).toContain('Aave');
    expect(protocols).toContain('Compound');
    expect(protocols).toContain('Lido');
    expect(protocols).toContain('Rocket Pool');
  });

  test('getSupportedProtocolsForAsset should return correct protocols for stablecoins', () => {
    const protocols = getSupportedProtocolsForAsset('USDC');
    
    expect(protocols).toContain('Aave');
    expect(protocols).toContain('Compound');
    expect(protocols).toContain('Curve');
    expect(protocols).toContain('Convex');
  });

  test('formatStakingInfo should format correctly', () => {
    const protocol: StakingProtocol = {
      name: 'Aave',
      chain: 'ethereum',
      supportedAssets: ['USDC'],
      apy: 5.5,
      tvlUsd: 100000000
    };

    const formatted = formatStakingInfo(protocol, 10000);
    
    expect(formatted).toContain('Aave');
    expect(formatted).toContain('5.50%');
    expect(formatted).toContain('$100,000,000');
    expect(formatted).toContain('$550.00'); // Annual yield
  });
});

describe('Swap and Stake - Edge Cases', () => {
  test('should handle case insensitive staking keywords', async () => {
    const result = await parseUserCommand('Swap 100 USDC for ETH and STAKE it');
    
    expect(result.success).toBe(true);
    expect(result.intent).toBe('swap_and_stake');
  });

  test('should handle "immediately" in different positions', async () => {
    const result1 = await parseUserCommand('Swap 100 USDC for ETH immediately and stake');
    const result2 = await parseUserCommand('Immediately swap 100 USDC for ETH and stake');
    
    expect(result1.intent).toBe('swap_and_stake');
    expect(result2.intent).toBe('swap_and_stake');
  });

  test('should handle protocol names with different cases', async () => {
    const result = await parseUserCommand('Swap 100 ETH to USDC and stake on aave');
    
    expect(result.success).toBe(true);
    expect(result.stakingProtocol).toBe('aave');
  });

  test('should handle "using" protocol syntax', async () => {
    const result = await parseUserCommand('Swap 100 USDC for ETH using Lido');
    
    expect(result.success).toBe(true);
    expect(result.intent).toBe('swap_and_stake');
    expect(result.stakingProtocol).toBe('Lido');
  });

  test('should handle "in" protocol syntax', async () => {
    const result = await parseUserCommand('Swap 100 DAI to USDC and stake in Compound');
    
    expect(result.success).toBe(true);
    expect(result.stakingProtocol).toBe('Compound');
  });

  test('should handle commands without explicit amount', async () => {
    const result = await parseUserCommand('Swap all ETH to USDC and stake');
    
    expect(result.success).toBe(true);
    expect(result.intent).toBe('swap_and_stake');
    expect(result.amountType).toBe('all');
  });

  test('should handle commands with "and" in asset names', async () => {
    // This tests that we don't get confused by "and" in the middle of tokens
    const result = await parseUserCommand('Swap 100 USDC to ETH and stake on Aave');
    
    expect(result.success).toBe(true);
    expect(result.fromAsset).toBe('USDC');
    expect(result.toAsset).toBe('ETH');
  });
});
