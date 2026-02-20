import axios from 'axios';
import { getStakingAbi, getStakingSelector, STAKING_FUNCTION_SELECTORS } from '../config/staking-abis';
import { getOrderStatus } from './sideshift-client';
import {
  getPendingOrders,
  updateOrderStatus,
} from './database';
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

export async function getTopYieldPools(): Promise<YieldPool[]> {
  try {
    // Fetch data from yield aggregator (likely DefiLlama based on variable names)
    const response = await axios.get('https://yields.llama.fi/pools');
    const data = response.data.data;

    const topPools = data.filter((p: any) =>
      ['USDC', 'USDT', 'DAI'].includes(p.symbol) &&
      p.tvlUsd > 1000000 &&
      ['Ethereum', 'Polygon', 'Arbitrum', 'Optimism', 'Base', 'Avalanche'].includes(p.chain)
    )
      .sort((a: any, b: any) => b.apy - a.apy)
      .slice(0, 5);

    if (topPools.length === 0) throw new Error("No pools found");

    return topPools.map((p: any) => ({
      chain: p.chain,
      project: p.project,
      symbol: p.symbol,
      tvlUsd: p.tvlUsd,
      apy: p.apy,
      poolId: p.pool
    }));

  } catch (error) {
    logger.error("Yield fetch error, using fallback data:", error);
    // Fallback Mock Data for demo reliability
    return [
      { chain: 'Base', project: 'Aave', symbol: 'USDC', tvlUsd: 5000000, apy: 12.4, poolId: 'base-aave-usdc' },
      { chain: 'Base', project: 'merkl', symbol: 'USDC', tvlUsd: 8000000, apy: 22.79, poolId: 'base-merkl-usdc' },
      { chain: 'Base', project: 'yo-protocol', symbol: 'USDC', tvlUsd: 4000000, apy: 19.28, poolId: 'base-yo-usdc' },
      { chain: 'Arbitrum', project: 'Radiant', symbol: 'USDC', tvlUsd: 6000000, apy: 15.2, poolId: 'arb-radiant-usdc' }
    ];
  }
}

export async function getTopStablecoinYields(): Promise<YieldPool[]> {
  return await getTopYieldPools();
}

export interface MigrationSuggestion {
  fromPool: YieldPool;
  toPool: YieldPool;
  apyDifference: number;
  annualExtraYield: number;
  isCrossChain: boolean;
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

export function calculateYieldMigration(relevantPools: YieldPool[], amount: number, chain?: string, fromAsset?: string): MigrationSuggestion | null {
  let fromPool = relevantPools.find(p => p.symbol === fromAsset);

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

export function formatYieldPools(yields: YieldPool[]): string {
  if (yields.length === 0) return "No yield opportunities found at the moment.";
  return yields.map(p => `• *${p.symbol} on ${p.chain}* via ${p.project}: *${p.apy.toFixed(2)}% APY*`).join('\n');
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
