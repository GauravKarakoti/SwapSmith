'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, Users, Star, Search, Filter, Plus, ArrowRight, Shield, AlertTriangle, Flame, Loader2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface TradingStrategy {
  id: number;
  creatorId: number;
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  riskLevel: 'low' | 'medium' | 'high' | 'aggressive';
  status: string;
  subscriptionFee: string;
  performanceFee: number;
  subscriberCount: number;
  totalTrades: number;
  successfulTrades: number;
  totalReturn: number;
  monthlyReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  volatility: number;
  tags: string[];
  minInvestment: string;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

interface StrategyFilters {
  riskLevel: string;
  search: string;
  sortBy: string;
}

export default function StrategyMarketplace() {
  const [strategies, setStrategies] = useState<TradingStrategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStrategy, setSelectedStrategy] = useState<TradingStrategy | null>(null);
  const [filters, setFilters] = useState<StrategyFilters>({
    riskLevel: '',
    search: '',
    sortBy: 'totalReturn',
  });

  useEffect(() => {
    fetchStrategies();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const fetchStrategies = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.riskLevel) params.set('riskLevel', filters.riskLevel);
      if (filters.search) params.set('search', filters.search);
      params.set('sortBy', filters.sortBy);
      params.set('limit', '20');

      const response = await fetch(`/api/strategies?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch strategies');
      
      const data = await response.json();
      setStrategies(data);
      setError(null);
    } catch (err) {
      setError('Failed to load strategies');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getRiskIcon = (risk: string) => {
    switch (risk) {
      case 'low':
        return <Shield className="w-4 h-4 text-green-500" />;
      case 'medium':
        return <TrendingUp className="w-4 h-4 text-yellow-500" />;
      case 'high':
        return <AlertTriangle className="w-4 h-4 text-orange-500" />;
      case 'aggressive':
        return <Flame className="w-4 h-4 text-red-500" />;
      default:
        return null;
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'low':
        return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'medium':
        return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      case 'high':
        return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
      case 'aggressive':
        return 'bg-red-500/10 text-red-500 border-red-500/20';
      default:
        return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
    }
  };

  const formatReturn = (value: number) => {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
  };

  return (
    <div className="w-full max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-gradient-to-br from-purple-500 to-blue-600 rounded-xl">
            <TrendingUp className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Strategy Marketplace
            </h1>
            <p className="text-gray-500 dark:text-gray-400">
              Discover and follow expert trading strategies
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 mb-6">
        <div className="flex flex-wrap gap-4">
          {/* Search */}
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search strategies..."
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                className="w-full pl-10 pr-4 py-2 bg-gray-100 dark:bg-gray-700 border-0 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>

          {/* Risk Level Filter */}
          <select
            value={filters.riskLevel}
            onChange={(e) => setFilters(prev => ({ ...prev, riskLevel: e.target.value }))}
            className="px-4 py-2 bg-gray-100 dark:bg-gray-700 border-0 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500"
          >
            <option value="">All Risk Levels</option>
            <option value="low">Low Risk</option>
            <option value="medium">Medium Risk</option>
            <option value="high">High Risk</option>
            <option value="aggressive">Aggressive</option>
          </select>

          {/* Sort */}
          <select
            value={filters.sortBy}
            onChange={(e) => setFilters(prev => ({ ...prev, sortBy: e.target.value }))}
            className="px-4 py-2 bg-gray-100 dark:bg-gray-700 border-0 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500"
          >
            <option value="totalReturn">Best Return</option>
            <option value="subscriberCount">Most Popular</option>
            <option value="monthlyReturn">Monthly Return</option>
            <option value="createdAt">Newest</option>
          </select>

          <button
            onClick={fetchStrategies}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors"
          >
            <Filter className="w-4 h-4 inline mr-2" />
            Apply
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg text-sm"
        >
          {error}
        </motion.div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
          <span className="ml-3 text-gray-500">Loading strategies...</span>
        </div>
      )}

      {/* Empty State */}
      {!loading && strategies.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-20 bg-gray-50 dark:bg-gray-800/50 rounded-xl"
        >
          <TrendingUp className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-medium text-gray-900 dark:text-white mb-2">
            No strategies found
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            Be the first to create a trading strategy!
          </p>
          <button className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors font-medium">
            <Plus className="w-4 h-4" />
            Create Strategy
          </button>
        </motion.div>
      )}

      {/* Strategy Grid */}
      {!loading && strategies.length > 0 && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence>
            {strategies.map((strategy) => (
              <motion.div
                key={strategy.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onClick={() => setSelectedStrategy(strategy)}
                className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 hover:shadow-xl transition-all cursor-pointer group"
              >
                {/* Strategy Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center text-white font-bold">
                      {strategy.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-purple-600 transition-colors">
                        {strategy.name}
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {strategy.subscriberCount} subscribers
                      </p>
                    </div>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getRiskColor(strategy.riskLevel)} flex items-center gap-1`}>
                    {getRiskIcon(strategy.riskLevel)}
                    {strategy.riskLevel}
                  </span>
                </div>

                {/* Description */}
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 line-clamp-2">
                  {strategy.description}
                </p>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Total return</p>
                    <p className={`text-lg font-bold ${strategy.totalReturn >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {formatReturn(strategy.totalReturn)}
                    </p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Monthly</p>
                    <p className={`text-lg font-bold ${strategy.monthlyReturn >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {formatReturn(strategy.monthlyReturn)}
                    </p>
                  </div>
                </div>

                {/* Metrics */}
                <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 mb-4">
                  <span className="flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {strategy.totalTrades} trades
                  </span>
                  <span className="flex items-center gap-1">
                    <Star className="w-3 h-3" />
                    {strategy.sharpeRatio.toFixed(2)} SR
                  </span>
                  <span className="flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    {strategy.maxDrawdown.toFixed(1)}% DD
                  </span>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Subscription</p>
                    <p className="font-semibold text-gray-900 dark:text-white">
                      {strategy.subscriptionFee === '0' ? 'Free' : `${strategy.subscriptionFee} tokens/mo`}
                    </p>
                  </div>
                  <button className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-1">
                    View
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Strategy Detail Modal */}
      <AnimatePresence>
        {selectedStrategy && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-40"
              onClick={() => setSelectedStrategy(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
            >
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden my-8">
                {/* Modal Header */}
                <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center text-white text-xl font-bold">
                        {selectedStrategy.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                          {selectedStrategy.name}
                        </h2>
                        <p className="text-gray-500 dark:text-gray-400">
                          Created {new Date(selectedStrategy.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedStrategy(null)}
                      className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Modal Content */}
                <div className="p-6 overflow-y-auto max-h-[60vh]">
                  {/* Risk Badge */}
                  <div className="mb-6">
                    <span className={`px-3 py-1.5 rounded-full text-sm font-medium border ${getRiskColor(selectedStrategy.riskLevel)} flex items-center gap-2 w-fit`}>
                      {getRiskIcon(selectedStrategy.riskLevel)}
                      {selectedStrategy.riskLevel.charAt(0).toUpperCase() + selectedStrategy.riskLevel.slice(1)} Risk
                    </span>
                  </div>

                  {/* Description */}
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                      Description
                    </h3>
                    <p className="text-gray-600 dark:text-gray-300">
                      {selectedStrategy.description}
                    </p>
                  </div>

                  {/* Performance Stats */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                      <p className="text-xs text-gray-500 dark:text-gray-400">Total return</p>
                      <p className={`text-2xl font-bold ${selectedStrategy.totalReturn >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {formatReturn(selectedStrategy.totalReturn)}
                      </p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                      <p className="text-xs text-gray-500 dark:text-gray-400">Monthly Return</p>
                      <p className={`text-2xl font-bold ${selectedStrategy.monthlyReturn >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {formatReturn(selectedStrategy.monthlyReturn)}
                      </p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                      <p className="text-xs text-gray-500 dark:text-gray-400">Sharpe Ratio</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {selectedStrategy.sharpeRatio.toFixed(2)}
                      </p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                      <p className="text-xs text-gray-500 dark:text-gray-400">Max Drawdown</p>
                      <p className="text-2xl font-bold text-red-500">
                        -{selectedStrategy.maxDrawdown.toFixed(1)}%
                      </p>
                    </div>
                  </div>

                  {/* Additional Stats */}
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                      <p className="text-xs text-gray-500 dark:text-gray-400">Subscribers</p>
                      <p className="text-xl font-bold text-gray-900 dark:text-white">
                        {selectedStrategy.subscriberCount}
                      </p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                      <p className="text-xs text-gray-500 dark:text-gray-400">Total Trades</p>
                      <p className="text-xl font-bold text-gray-900 dark:text-white">
                        {selectedStrategy.totalTrades}
                      </p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                      <p className="text-xs text-gray-500 dark:text-gray-400">Success Rate</p>
                      <p className="text-xl font-bold text-gray-900 dark:text-white">
                        {selectedStrategy.totalTrades > 0 
                          ? ((selectedStrategy.successfulTrades / selectedStrategy.totalTrades) * 100).toFixed(1)
                          : 0}%
                      </p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                      <p className="text-xs text-gray-500 dark:text-gray-400">Min Investment</p>
                      <p className="text-xl font-bold text-gray-900 dark:text-white">
                        ${selectedStrategy.minInvestment}
                      </p>
                    </div>
                  </div>

                  {/* Tags */}
                  {selectedStrategy.tags && selectedStrategy.tags.length > 0 && (
                    <div className="mb-6">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                        Tags
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {selectedStrategy.tags.map((tag) => (
                          <span
                            key={tag}
                            className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full text-sm"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Pricing */}
                  <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 border border-purple-200 dark:border-purple-800">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-purple-600 dark:text-purple-400">Subscription Fee</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">
                          {selectedStrategy.subscriptionFee === '0' 
                            ? 'Free' 
                            : `${selectedStrategy.subscriptionFee} tokens/month`}
                        </p>
                      </div>
                      {selectedStrategy.performanceFee > 0 && (
                        <div className="text-right">
                          <p className="text-sm text-purple-600 dark:text-purple-400">Performance Fee</p>
                          <p className="text-xl font-bold text-gray-900 dark:text-white">
                            {selectedStrategy.performanceFee}%
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                  <div className="flex gap-3">
                    <button
                      onClick={() => setSelectedStrategy(null)}
                      className="flex-1 px-4 py-3 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg font-medium transition-colors"
                    >
                      Close
                    </button>
                    <button className="flex-1 px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2">
                      <Users className="w-4 h-4" />
                      Subscribe to Strategy
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
