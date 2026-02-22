import axios from 'axios';
import logger from './logger';

export interface YieldPool {
  chain: string;
  project: string;
  symbol: string;
  apy: number;
  tvlUsd: number;
  poolId?: string;
}

export interface StakingQuote {
  pool: YieldPool;
  stakeAmount: string;
  estimatedReward: string;
  lockPeriod?: string;
  transactionData?: {
    to: string;
    value: string;
    data: string;
  }
}

export interface MigrationSuggestion {
  fromPool: YieldPool;
  toPool: YieldPool;
  apyDifference: number;
  annualExtraYield: number;
  isCrossChain: boolean;
}

export async function getTopStablecoinYields(): Promise<string> {
  try {
    // Attempt to fetch from DefiLlama (Open API)
    const response = await axios.get('https://yields.llama.fi/pools');
    const data = response.data.data;

    // Filter for stablecoins, high APY, major chains, and sufficient TVL
    const topPools = data
      .filter((p: any) =>
        ['USDC', 'USDT', 'DAI'].includes(p.symbol) &&
        p.tvlUsd > 1000000 &&
        ['Ethereum', 'Polygon', 'Arbitrum', 'Optimism', 'Base', 'Avalanche'].includes(p.chain)
      )
      .sort((a: any, b: any) => b.apy - a.apy)
      .slice(0, 5);
      
    if (topPools.length === 0) return "No high-yield pools found at the moment.";

    return topPools.map((p: any) =>
      `• *${p.symbol} on ${p.chain}* via ${p.project}: *${p.apy.toFixed(2)}% APY*`
    ).join('\n');

  } catch (error) {
    logger.error("Yield fetch error:", error);
    return "❌ Failed to fetch current yields.";
  }
}

export async function getTopYieldPools(): Promise<YieldPool[]> {
  try {
    const response = await axios.get('https://yields.llama.fi/pools');
    const data = response.data.data;
    return data
      .filter((p: any) =>
        ['USDC', 'USDT', 'DAI'].includes(p.symbol) &&
        p.tvlUsd > 1000000 &&
        ['Ethereum', 'Polygon', 'Arbitrum', 'Optimism', 'Base', 'Avalanche'].includes(p.chain)
      )
      .sort((a: any, b: any) => b.apy - a.apy)
      .slice(0, 5);
  } catch (error) {
    logger.error("Error fetching yield pools:", error);
    return [];
  }
}

export async function findHigherYieldPools(
  asset: string,
  chain?: string,
  minApy: number = 0
): Promise<YieldPool[]> {
  const pools = await getTopYieldPools();
  return pools.filter(p =>
    p.symbol.toUpperCase() === asset.toUpperCase() &&
    p.apy > minApy &&
    (!chain || p.chain.toLowerCase() === chain.toLowerCase())
  ).sort((a, b) => b.apy - a.apy);
}

export function calculateYieldMigration(relevantPools: YieldPool[], amount: number, chain?: string, sourceAsset?: string): MigrationSuggestion | null {
  let fromPool = relevantPools.find(p => p.symbol === sourceAsset);

  if (!fromPool && chain) {
    fromPool = relevantPools.find(p => p.chain.toLowerCase() === chain.toLowerCase());
  }

  const toPool = relevantPools.reduce((highest, p) => p.apy > highest.apy ? p : highest, relevantPools[0]);

  if (!fromPool) {
    fromPool = relevantPools.find(p => p.apy < toPool.apy && p.poolId !== toPool.poolId);
  }

  if (!fromPool || !toPool) return null;

  const apyDifference = toPool.apy - fromPool.apy;
  const annualExtraYield = (amount * apyDifference) / 100;

  return {
    fromPool,
    toPool,
    apyDifference,
    annualExtraYield,
    isCrossChain: fromPool.chain.toLowerCase() !== toPool.chain.toLowerCase()
  };
}

export function formatMigrationMessage(suggestion: MigrationSuggestion, amount: number = 10000): string {
  const { fromPool, toPool, apyDifference, annualExtraYield } = suggestion;
  return `📊 *Yield Migration Opportunity*\n\n` +
    `*Current:* ${fromPool.symbol} on ${fromPool.chain} via ${fromPool.project}\n` +
    `  APY: ${fromPool.apy.toFixed(2)}%\n\n` +
    `*Target:* ${toPool.symbol} on ${toPool.chain} via ${toPool.project}\n` +
    `  APY: ${toPool.apy.toFixed(2)}%\n\n` +
    `*Improvement:* +${apyDifference.toFixed(2)}% APY\n` +
    `*Extra Annual Yield:* $${annualExtraYield.toFixed(2)} on $${amount}`;
}