import axios from 'axios';

export interface YieldPool {
  chain: string;
  project: string;
  symbol: string;
  tvlUsd: number;
  apy: number;
  poolId?: string; // DefiLlama pool ID
}

export async function getTopYieldPools(): Promise<YieldPool[]> {
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
    console.error("Yield fetch error, using fallback data:", error);
    // Fallback Mock Data for demo reliability
    return [
      { chain: 'Base', project: 'Aave', symbol: 'USDC', tvlUsd: 5000000, apy: 12.4 },
      { chain: 'Arbitrum', project: 'Radiant', symbol: 'USDT', tvlUsd: 3000000, apy: 8.2 },
      { chain: 'Optimism', project: 'Velodrome', symbol: 'USDC', tvlUsd: 2000000, apy: 6.5 }
    ];
  }
}

export async function getTopStablecoinYields(): Promise<string> {
  const pools = await getTopYieldPools();
  return pools.map(p => 
    `• *${p.symbol} on ${p.chain}* via ${p.project}: *${p.apy.toFixed(2)}% APY*`
  ).join('\n');
}