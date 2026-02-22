import axios from 'axios';
import { yieldConfig } from '@/config/yield.config';
import logger from '@/lib/logger';

export interface YieldPool {
  chain: string;
  project: string;
  symbol: string;
  apy: number;
  tvlUsd: number;
  poolId?: string;
}

export async function getTopStablecoinYields(): Promise<YieldPool[]> {
  try {
    const response = await axios.get('https://yields.llama.fi/pools');
    const data = response.data.data;
    const allowedAssets = new Set<string>(yieldConfig.assets);
    const allowedChains = new Set<string>(yieldConfig.chains);

    // Filter for stablecoins, high APY, major chains, and sufficient TVL
    const topPools = data
      .filter((p: { symbol: string; tvlUsd: number; chain: string }) => 
        allowedAssets.has(p.symbol) && 
        p.tvlUsd > 1000000 && 
        allowedChains.has(p.chain)
      )
      .sort((a: { apy: number }, b: { apy: number }) => b.apy - a.apy)
      .slice(0, 5)
      .map((p: { symbol: string; chain: string; project: string; apy: number; tvlUsd: number; poolId?: string }) => ({
        chain: p.chain,
        project: p.project,
        symbol: p.symbol,
        apy: p.apy,
        tvlUsd: p.tvlUsd,
        poolId: p.poolId
      }));

    return topPools;

  } catch (error: unknown) {
    const err = error as Error;
    logger.error("Yield fetch error:", { error: err.message });
    return [];
  }
}

export function formatYieldPools(yields: YieldPool[]): string {
  if (yields.length === 0) return "Could not fetch live yield data at the moment.";
  
  return yields.map((p) => 
    `• ${p.symbol} on ${p.chain} via ${p.project}: **${p.apy.toFixed(2)}% APY**`
  ).join('\n');
}
