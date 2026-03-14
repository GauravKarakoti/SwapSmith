import axios from 'axios';
import logger from './logger';

export interface YieldPool {
  chain: string;
  project: string;
  symbol: string;
  apy: number;
  tvlUsd: number;
  poolId?: string;
  depositAddress?: string;
  rewardToken?: string;
  underlyingToken?: string;
}

export interface YieldProtocol {
  name: string;
  project: string;
  depositAddress: string;
  chain: string;
  rewardToken: string;
  apyType: 'variable' | 'fixed' | 'dynamic';
}

/* ------------------------------------------------ */
/* Yield Protocol Deposit Addresses */
/* ------------------------------------------------ */

export const YIELD_PROTOCOLS: YieldProtocol[] = [
  {
    name: 'Aave V3',
    project: 'aave-v3',
    depositAddress: '0x87870Bca3F3fD6335E32cdC2d17F6b8d2c2A3eE1',
    chain: 'Ethereum',
    rewardToken: 'AAVE',
    apyType: 'variable'
  },
  {
    name: 'Aave V3',
    project: 'aave-v3',
    depositAddress: '0x625E7708f30cA75bfd92586e17077590C60eb4cD',
    chain: 'Arbitrum',
    rewardToken: 'AAVE',
    apyType: 'variable'
  },
  {
    name: 'Aave V3',
    project: 'aave-v3',
    depositAddress: '0x625E7708f30cA75bfd92586e17077590C60eb4cD',
    chain: 'Polygon',
    rewardToken: 'AAVE',
    apyType: 'variable'
  },
  {
    name: 'Compound V3',
    project: 'compound-v3',
    depositAddress: '0xc3d688B66703497DAA19211EEdff47f253B8A93',
    chain: 'Ethereum',
    rewardToken: 'COMP',
    apyType: 'variable'
  },
  {
    name: 'Lido',
    project: 'lido',
    depositAddress: '0xae7ab96520DE3A18f5e31e70f08B3B58f1dB0c9A',
    chain: 'Ethereum',
    rewardToken: 'LDO',
    apyType: 'dynamic'
  },
  {
    name: 'Yearn',
    project: 'yearn',
    depositAddress: '0x5f18C75AbDAe578b483E2F0EA721C3aB1893D7a6',
    chain: 'Ethereum',
    rewardToken: 'YFI',
    apyType: 'variable'
  },
  {
    name: 'Morpho Blue',
    project: 'morpho-blue',
    depositAddress: '0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb',
    chain: 'Ethereum',
    rewardToken: 'MORPHO',
    apyType: 'variable'
  },
  {
    name: 'Euler V2',
    project: 'euler',
    depositAddress: '0xD8b27CF359b7D15710a5BE299AF6e7Bf904984C2',
    chain: 'Ethereum',
    rewardToken: 'EUL',
    apyType: 'variable'
  },
  {
    name: 'Spark',
    project: 'spark',
    depositAddress: '0xC13e21B648A5Ee794902342038FF3aDAB66BE987',
    chain: 'Ethereum',
    rewardToken: 'SPK',
    apyType: 'variable'
  }
];

/* ------------------------------------------------ */
/* Liquid Staking Providers */
/* ------------------------------------------------ */

export interface StakingProvider {
  token: string;
  provider: string;
  stakingToken: string;
  apr: number;
  chain: string;
  depositAddress: string;
  supportsRestaking?: boolean;
}

export const STAKING_PROVIDERS: Record<string, StakingProvider[]> = {
  ETH: [
    {
      token: 'ETH',
      provider: 'Lido',
      stakingToken: 'stETH',
      apr: 3.8,
      chain: 'ethereum',
      depositAddress: '0xae7ab96520DE3A18f5e31e70f08B3B58f1dB0c9A',
      supportsRestaking: true
    },
    {
      token: 'ETH',
      provider: 'Rocket Pool',
      stakingToken: 'rETH',
      apr: 3.6,
      chain: 'ethereum',
      depositAddress: '0xae7ab96520DE3A18f5e31e70f08B3B58f1dB0c9A',
      supportsRestaking: true
    }
  ],
  MATIC: [
    {
      token: 'MATIC',
      provider: 'Stader',
      stakingToken: 'MATICx',
      apr: 4.2,
      chain: 'polygon',
      depositAddress: '0x0000000000000000000000000000000000000000'
    },
    {
      token: 'MATIC',
      provider: 'Lido',
      stakingToken: 'stMATIC',
      apr: 4.0,
      chain: 'polygon',
      depositAddress: '0x0000000000000000000000000000000000000000'
    }
  ],
  SOL: [
    {
      token: 'SOL',
      provider: 'Marinade',
      stakingToken: 'mSOL',
      apr: 6.8,
      chain: 'solana',
      depositAddress: 'MarinadeStake11111111111111111111111111111'
    }
  ],
  ATOM: [
    {
      token: 'ATOM',
      provider: 'Stride',
      stakingToken: 'stATOM',
      apr: 18.5,
      chain: 'cosmos',
      depositAddress: 'cosmos1placeholder'
    }
  ],
  USDC: [
    {
      token: 'USDC',
      provider: 'Aave',
      stakingToken: 'aUSDC',
      apr: 4.5,
      chain: 'ethereum',
      depositAddress: '0x87870Bca3F3f6335e32cdC2d17F6b8d2c2A3eE1'
    },
    {
      token: 'USDC',
      provider: 'Compound',
      stakingToken: 'cUSDC',
      apr: 4.2,
      chain: 'ethereum',
      depositAddress: '0xc3d688B66703497DAA19211EEdff47f253B8A93'
    }
  ]
};

/* ------------------------------------------------ */
/* Staking Helpers */
/* ------------------------------------------------ */

export function getStakingProvider(
  token: string,
  preferredProvider?: string
): StakingProvider | null {
  const providers = STAKING_PROVIDERS[token.toUpperCase()];
  if (!providers) return null;

  if (preferredProvider) {
    const match = providers.find(
      p => p.provider.toLowerCase() === preferredProvider.toLowerCase()
    );
    if (match) return match;
  }

  return providers.reduce((best, current) =>
    current.apr > best.apr ? current : best
  );
}

export function isStakingSupported(token: string): boolean {
  return token.toUpperCase() in STAKING_PROVIDERS;
}

export function getSupportedStakingTokens(): string[] {
  return Object.keys(STAKING_PROVIDERS);
}

/* ------------------------------------------------ */
/* Yield Fetching */
/* ------------------------------------------------ */

export async function getTopYieldPools(): Promise<YieldPool[]> {
  try {
    const response = await axios.get('https://yields.llama.fi/pools');

    const data = response.data;

    const topPools = data
      .filter(
        (p: any) =>
          ['USDC', 'USDT', 'DAI'].includes(p.symbol) &&
          p.tvlUsd > 1_000_000 &&
          ['Ethereum', 'Polygon', 'Arbitrum', 'Optimism', 'Base', 'Avalanche'].includes(p.chain)
      )
      .sort((a: any, b: any) => b.apy - a.apy)
      .slice(0, 5);

    return topPools.map((p: any) => ({
      chain: p.chain,
      project: p.project,
      symbol: p.symbol,
      tvlUsd: p.tvlUsd,
      apy: p.apy,
      poolId: p.pool
    }));
  } catch (error) {
    logger.error('Yield fetch error, using fallback data:', error);

    return [
      { chain: 'Base', project: 'Aave', symbol: 'USDC', tvlUsd: 5000000, apy: 12.4 },
      { chain: 'Base', project: 'merkl', symbol: 'USDC', tvlUsd: 8000000, apy: 22.79 },
      { chain: 'Base', project: 'yo-protocol', symbol: 'USDC', tvlUsd: 4000000, apy: 19.28 },
      { chain: 'Arbitrum', project: 'Radiant', symbol: 'USDC', tvlUsd: 6000000, apy: 15.2 }
    ];
  }
}

/* ------------------------------------------------ */
/* Deposit Address Helpers */
/* ------------------------------------------------ */

export function getDepositAddress(pool: YieldPool): string | null {
  const protocol = YIELD_PROTOCOLS.find(
    p =>
      p.project === pool.project &&
      p.chain.toLowerCase() === pool.chain.toLowerCase()
  );
  return protocol?.depositAddress || null;
}

export function getProtocolInfo(pool: YieldPool): YieldProtocol | null {
  return (
    YIELD_PROTOCOLS.find(
      p =>
        p.project === pool.project &&
        p.chain.toLowerCase() === pool.chain.toLowerCase()
    ) || null
  );
}

export function enrichPoolWithDepositAddress(pool: YieldPool): YieldPool {
  const protocol = getProtocolInfo(pool);

  return {
    ...pool,
    depositAddress: protocol?.depositAddress,
    rewardToken: protocol?.rewardToken,
    underlyingToken: pool.symbol
  };
}