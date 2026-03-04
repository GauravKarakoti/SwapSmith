'use client';

import { useState, useEffect } from 'react';
import { BarChart3, ArrowRight, CheckCircle, XCircle } from 'lucide-react';

interface ChainGasData {
  chain: string;
  gasPrice: string;
  formatted: string;
  confidence: number;
  estimatedTimeSeconds?: number;
}

interface GasComparison {
  fromChain: string;
  toChain: string;
  currentGas: ChainGasData;
  recommendedGas: ChainGasData;
  savings: {
    amount: string;
    percent: number;
  };
  recommendation: 'execute_now' | 'wait' | 'use_token' | 'batch';
  reason: string;
}

interface GasComparisonChartProps {
  fromChain: string;
  toChain: string;
  showRecommendation?: boolean;
  className?: string;
}

export default function GasComparisonChart({
  fromChain,
  toChain,
  showRecommendation = true,
  className = '',
}: GasComparisonChartProps) {
  const [comparison, setComparison] = useState<GasComparison | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchComparison();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromChain, toChain]);

  const fetchComparison = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `/api/gas-estimate?chain=${fromChain}&compare=${toChain}`
      );
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch comparison');
      }

      setComparison(data.comparison);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch comparison');
    } finally {
      setLoading(false);
    }
  };

  const getRecommendationIcon = () => {
    if (!comparison) return null;
    
    switch (comparison.recommendation) {
      case 'execute_now':
        return <CheckCircle className="w-5 h-5 text-green-400" />;
      case 'wait':
        return <XCircle className="w-5 h-5 text-yellow-400" />;
      case 'use_token':
        return <CheckCircle className="w-5 h-5 text-blue-400" />;
      case 'batch':
        return <CheckCircle className="w-5 h-5 text-purple-400" />;
      default:
        return null;
    }
  };

  const getRecommendationColor = () => {
    if (!comparison) return 'text-gray-400';
    
    switch (comparison.recommendation) {
      case 'execute_now':
        return 'text-green-400';
      case 'wait':
        return 'text-yellow-400';
      case 'use_token':
        return 'text-blue-400';
      case 'batch':
        return 'text-purple-400';
      default:
        return 'text-gray-400';
    }
  };

  const getRecommendationBg = () => {
    if (!comparison) return 'bg-gray-500/10';
    
    switch (comparison.recommendation) {
      case 'execute_now':
        return 'bg-green-500/10 border-green-500/20';
      case 'wait':
        return 'bg-yellow-500/10 border-yellow-500/20';
      case 'use_token':
        return 'bg-blue-500/10 border-blue-500/20';
      case 'batch':
        return 'bg-purple-500/10 border-purple-500/20';
      default:
        return 'bg-gray-500/10 border-gray-500/20';
    }
  };

  const formatPercent = (percent: number) => {
    return `${percent.toFixed(1)}%`;
  };

  if (loading) {
    return (
      <div className={`bg-white/5 border border-white/10 rounded-xl p-6 ${className}`}>
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-white/10 rounded w-32" />
          <div className="flex items-center gap-4">
            <div className="flex-1 h-20 bg-white/10 rounded-lg" />
            <div className="w-8 h-8 bg-white/10 rounded-full" />
            <div className="flex-1 h-20 bg-white/10 rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-red-500/10 border border-red-500/20 rounded-xl p-6 ${className}`}>
        <p className="text-sm text-red-400">{error}</p>
      </div>
    );
  }

  if (!comparison) return null;

  const fromPrice = parseFloat(comparison.currentGas.gasPrice);
  const toPrice = parseFloat(comparison.recommendedGas.gasPrice);
  const maxPrice = Math.max(fromPrice, toPrice);
  const fromPercent = (fromPrice / maxPrice) * 100;
  const toPercent = (toPrice / maxPrice) * 100;

  return (
    <div className={`bg-white/5 border border-white/10 rounded-xl p-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <BarChart3 className="w-5 h-5 text-blue-400" />
        <h3 className="text-lg font-semibold text-white">Gas Comparison</h3>
      </div>

      {/* Comparison Bars */}
      <div className="space-y-6 mb-6">
        {/* From Chain */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-white capitalize">{fromChain}</span>
            <span className="text-sm text-gray-400">{comparison.currentGas.formatted}</span>
          </div>
          <div className="h-3 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-500"
              style={{ width: `${fromPercent}%` }}
            />
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-xs text-gray-500">
              Confidence: {comparison.currentGas.confidence}%
            </span>
            <span className="text-xs text-gray-500">
              ~{Math.round((comparison.currentGas.estimatedTimeSeconds || 60) / 60)}m confirmation
            </span>
          </div>
        </div>

        {/* Arrow */}
        <div className="flex justify-center">
          <ArrowRight className="w-6 h-6 text-gray-500" />
        </div>

        {/* To Chain */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-white capitalize">{toChain}</span>
            <span className="text-sm text-gray-400">{comparison.recommendedGas.formatted}</span>
          </div>
          <div className="h-3 bg-white/10 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                toPrice < fromPrice ? 'bg-green-500' : 'bg-red-500'
              }`}
              style={{ width: `${toPercent}%` }}
            />
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-xs text-gray-500">
              Confidence: {comparison.recommendedGas.confidence}%
            </span>
            <span className="text-xs text-gray-500">
              ~{Math.round((comparison.recommendedGas.estimatedTimeSeconds || 60) / 60)}m confirmation
            </span>
          </div>
        </div>
      </div>

      {/* Savings Display */}
      {comparison.savings.percent > 0 && (
        <div className="bg-white/5 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400">Price Difference</span>
            <span className={`text-lg font-bold ${
              fromPrice > toPrice ? 'text-green-400' : 'text-red-400'
            }`}>
              {fromPrice > toPrice ? '-' : '+'}
              {formatPercent(comparison.savings.percent)}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {fromPrice > toPrice 
              ? `${toChain} is cheaper by ${comparison.savings.amount} Gwei`
              : `${toChain} is more expensive by ${comparison.savings.amount} Gwei`
            }
          </p>
        </div>
      )}

      {/* Recommendation */}
      {showRecommendation && (
        <div className={`border rounded-lg p-4 ${getRecommendationBg()}`}>
          <div className="flex items-start gap-3">
            {getRecommendationIcon()}
            <div>
              <h4 className={`text-sm font-semibold capitalize ${getRecommendationColor()}`}>
                {comparison.recommendation.replace('_', ' ')}
              </h4>
              <p className="text-sm text-gray-400 mt-1">{comparison.reason}</p>
            </div>
          </div>
        </div>
      )}

      {/* Refresh */}
      <div className="flex justify-end mt-4">
        <button
          onClick={fetchComparison}
          disabled={loading}
          className="text-xs text-blue-400 hover:text-blue-300 disabled:opacity-50"
        >
          {loading ? 'Refreshing...' : 'Refresh Data'}
        </button>
      </div>
    </div>
  );
}
