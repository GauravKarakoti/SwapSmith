import axios from 'axios';
import { getStakingAbi, getStakingSelector, STAKING_FUNCTION_SELECTORS } from '../config/staking-abis';
import { getOrderStatus } from './sideshift-client';
import { 
  getPendingStakeOrders, 
  updateStakeOrderSwapStatus, 
  updateStakeOrderStakeStatus,
  type StakeOrder 
} from './database';
import logger from './logger';


export interface YieldPool {
  chain: string;
  project: string;
  symbol: string;
  tvlUsd: number;
  apy: number;
  poolId?: string; // DefiLlama pool ID
}

<<<<<<< HEAD
export interface StakingQuote {
  pool: StakingPool;
  stakeAmount: string;
  estimatedReward: string;
  lockPeriod?: string;
  transactionData?: {
    to: string;
    value: string;
    data: string;
        ['USDC', 'USDT', 'DAI'].includes(p.symbol) && 
        ['Ethereum', 'Polygon', 'Arbitrum', 'Optimism', 'Base', 'Avalanche'].includes(p.chain)
      )
      .sort((a: any, b: any) => b.apy - a.apy)
      .slice(0, 5); // Increased to 5 to give more options

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

export async function getTopStablecoinYields(): Promise<string> {
  const pools = await getTopYieldPools();
  return pools.map(p =>
    `• *${p.symbol} on ${p.chain}* via ${p.project}: *${p.apy.toFixed(2)}% APY*`
  ).join('\n');
}

export interface MigrationSuggestion {
  fromPool: YieldPool;
  toPool: YieldPool;
  apyDifference: number;
  annualExtraYield: number;
  isCrossChain: boolean;
}

export async function suggestMigration(
  asset: string,
  chain?: string,
  currentProject?: string,
  amount: number = 10000
): Promise<MigrationSuggestion | null> {
  const pools = await getTopYieldPools();
  const relevantPools = pools.filter(p => p.symbol.toUpperCase() === asset.toUpperCase());

  if (relevantPools.length < 1) return null;

  let fromPool: YieldPool | undefined;

  if (currentProject) {
    fromPool = relevantPools.find(p =>
      p.project.toLowerCase() === currentProject.toLowerCase() &&
      (!chain || p.chain.toLowerCase() === chain.toLowerCase())
    );
  }

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
