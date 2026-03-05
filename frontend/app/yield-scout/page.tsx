'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, Search, Filter, ArrowUpRight, Shield, Zap, ChevronDown } from 'lucide-react';
import Link from 'next/link';

interface YieldPool {
  chain: string;
  project: string;
  symbol: string;
  apy: number;
  tvlUsd: number;
  poolId?: string;
  depositAddress?: string;
  rewardToken?: string;
}

export default function YieldScoutPage() {
  const [pools, setPools] = useState<YieldPool[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedChain, setSelectedChain] = useState<string>('all');
  const [selectedAsset, setSelectedAsset] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'apy' | 'tvl'>('apy');

  useEffect(() => {
    fetchYieldData();
  }, []);

  const fetchYieldData = async () => {
    try {
      setLoading(true);
      const response = await fetch('https://yields.llama.fi/pools');
      const data = await response.json();

      const filtered = data.filter((p: any) =>
        ['USDC', 'USDT', 'DAI', 'ETH', 'WETH', 'WBTC'].includes(p.symbol) &&
        p.tvlUsd > 100000 &&
        ['Ethereum', 'Polygon', 'Arbitrum', 'Optimism', 'Base', 'Avalanche'].includes(p.chain)
      );

      setPools(filtered);
    } catch (error) {
      console.error('Error fetching yield data:', error);
      // Fallback data
      setPools([
        { chain: 'Ethereum', project: 'Aave V3', symbol: 'USDC', tvlUsd: 5000000, apy: 4.2, poolId: 'aave-eth-usdc' },
        { chain: 'Arbitrum', project: 'Aave V3', symbol: 'USDC', tvlUsd: 3000000, apy: 5.8, poolId: 'aave-arb-usdc' },
        { chain: 'Ethereum', project: 'Compound V3', symbol: 'USDC', tvlUsd: 4000000, apy: 3.9, poolId: 'comp-eth-usdc' },
        { chain: 'Ethereum', project: 'Lido', symbol: 'ETH', tvlUsd: 20000000, apy: 3.5, poolId: 'lido-eth' },
        { chain: 'Ethereum', project: 'Yearn', symbol: 'USDC', tvlUsd: 2000000, apy: 6.2, poolId: 'yearn-eth-usdc' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const chains = ['all', ...Array.from(new Set(pools.map(p => p.chain)))];
  const assets = ['all', ...Array.from(new Set(pools.map(p => p.symbol)))];

  const filteredPools = pools
    .filter(p => {
      const matchesSearch = p.project.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           p.symbol.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesChain = selectedChain === 'all' || p.chain === selectedChain;
      const matchesAsset = selectedAsset === 'all' || p.symbol === selectedAsset;
      return matchesSearch && matchesChain && matchesAsset;
    })
    .sort((a, b) => sortBy === 'apy' ? b.apy - a.apy : b.tvlUsd - a.tvlUsd);

  const getRiskLevel = (apy: number): { level: string; color: string } => {
    if (apy < 5) return { level: 'Low', color: 'text-green-400' };
    if (apy < 15) return { level: 'Medium', color: 'text-yellow-400' };
    return { level: 'High', color: 'text-red-400' };
  };

  return (
    <main className="min-h-screen bg-[#050505] text-white">
      {/* Header */}
      <div className="border-b border-white/10 bg-zinc-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Yield Scout</h1>
                <p className="text-xs text-zinc-400">Discover the best DeFi yields</p>
              </div>
            </div>
            <Link
              href="/"
              className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm transition-colors"
            >
              ← Back
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-2">
              <Zap className="w-5 h-5 text-blue-400" />
              <span className="text-sm text-zinc-400">Total Pools</span>
            </div>
            <p className="text-3xl font-bold">{pools.length}</p>
          </div>
          <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-2">
              <TrendingUp className="w-5 h-5 text-green-400" />
              <span className="text-sm text-zinc-400">Avg APY</span>
            </div>
            <p className="text-3xl font-bold">
              {pools.length > 0 ? (pools.reduce((sum, p) => sum + p.apy, 0) / pools.length).toFixed(2) : '0'}%
            </p>
          </div>
          <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-2">
              <Shield className="w-5 h-5 text-purple-400" />
              <span className="text-sm text-zinc-400">Total TVL</span>
            </div>
            <p className="text-3xl font-bold">
              ${pools.length > 0 ? (pools.reduce((sum, p) => sum + p.tvlUsd, 0) / 1000000).toFixed(1) : '0'}M
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input
                type="text"
                placeholder="Search protocols..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-zinc-800 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Chain Filter */}
            <select
              value={selectedChain}
              onChange={(e) => setSelectedChain(e.target.value)}
              className="px-4 py-2 bg-zinc-800 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-blue-500"
            >
              {chains.map(chain => (
                <option key={chain} value={chain}>{chain === 'all' ? 'All Chains' : chain}</option>
              ))}
            </select>

            {/* Asset Filter */}
            <select
              value={selectedAsset}
              onChange={(e) => setSelectedAsset(e.target.value)}
              className="px-4 py-2 bg-zinc-800 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-blue-500"
            >
              {assets.map(asset => (
                <option key={asset} value={asset}>{asset === 'all' ? 'All Assets' : asset}</option>
              ))}
            </select>

            {/* Sort */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'apy' | 'tvl')}
              className="px-4 py-2 bg-zinc-800 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-blue-500"
            >
              <option value="apy">Sort by APY</option>
              <option value="tvl">Sort by TVL</option>
            </select>
          </div>
        </div>

        {/* Pools List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredPools.map((pool, index) => {
              const risk = getRiskLevel(pool.apy);
              return (
                <div
                  key={pool.poolId || index}
                  className="bg-zinc-900/50 border border-white/10 rounded-xl p-6 hover:border-blue-500/50 transition-all group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl flex items-center justify-center text-white font-bold">
                        {pool.symbol.slice(0, 2)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-bold text-lg">{pool.project}</h3>
                          <span className="px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 rounded text-xs text-blue-400">
                            {pool.chain}
                          </span>
                        </div>
                        <p className="text-sm text-zinc-400">{pool.symbol} Pool</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-8">
                      <div className="text-right">
                        <p className="text-sm text-zinc-400 mb-1">APY</p>
                        <p className="text-2xl font-bold text-green-400">{pool.apy.toFixed(2)}%</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-zinc-400 mb-1">TVL</p>
                        <p className="text-lg font-semibold">${(pool.tvlUsd / 1000000).toFixed(2)}M</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-zinc-400 mb-1">Risk</p>
                        <p className={`text-sm font-semibold ${risk.color}`}>{risk.level}</p>
                      </div>
                      <button className="px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 group-hover:scale-105">
                        Deposit
                        <ArrowUpRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredPools.length === 0 && (
              <div className="text-center py-20">
                <p className="text-zinc-400">No pools found matching your filters</p>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
