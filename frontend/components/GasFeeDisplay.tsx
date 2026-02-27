'use client';

import { useState, useEffect } from 'react';
import { Fuel, TrendingDown, TrendingUp, Clock, AlertCircle } from 'lucide-react';

interface GasEstimate {
  chain: string;
  network: string;
  gasPrice: string;
  gasPriceUnit: string;
  priorityFee?: string;
  baseFee?: string;
  estimatedTimeSeconds?: number;
  confidence: number;
  source: string;
  formatted?: string;
  timestamp?: Date;
  expiresAt?: Date;
}


interface GasPrediction {
  predictedPrice: string;
  confidence: number;
  trend: 'rising' | 'falling' | 'stable';
}

interface GasFeeDisplayProps {
  chain: string;
  network?: string;
  showPrediction?: boolean;
  showOptimization?: boolean;
  userId?: string;
  compact?: boolean;
  className?: string;
}

export default function GasFeeDisplay({
  chain,
  network = 'mainnet',
  showPrediction = true,
  showOptimization = true,
  userId,
  compact = false,
  className = '',
}: GasFeeDisplayProps) {
  const [gasEstimate, setGasEstimate] = useState<GasEstimate | null>(null);
  const [prediction, setPrediction] = useState<GasPrediction | null>(null);
  const [optimization, setOptimization] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchGasData();
    const interval = setInterval(fetchGasData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [chain, network, userId]);

  const fetchGasData = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        chain,
        network,
        ...(userId && { userId }),
        ...(showOptimization && { includeTokens: 'true' }),
      });

      const response = await fetch(`/api/gas-estimate?${params}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch gas estimate');
      }

      setGasEstimate(data.estimate);
      if (showPrediction) {
        setPrediction(data.prediction);
      }
      if (showOptimization && data.optimization) {
        setOptimization(data.optimization);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch gas data');
    } finally {
      setLoading(false);
    }
  };

  const getTrendIcon = () => {
    if (!prediction) return null;
    
    switch (prediction.trend) {
      case 'rising':
        return <TrendingUp className="w-4 h-4 text-red-500" />;
      case 'falling':
        return <TrendingDown className="w-4 h-4 text-green-500" />;
      default:
        return <Clock className="w-4 h-4 text-yellow-500" />;
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 90) return 'text-green-500';
    if (confidence >= 70) return 'text-yellow-500';
    return 'text-red-500';
  };

  const formatTime = (seconds?: number) => {
    if (!seconds) return 'Unknown';
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
    return `${Math.round(seconds / 3600)}h`;
  };

  if (loading && !gasEstimate) {
    return (
      <div className={`bg-white/5 border border-white/10 rounded-xl p-4 ${className}`}>
        <div className="animate-pulse flex items-center gap-3">
          <div className="w-8 h-8 bg-white/10 rounded-lg" />
          <div className="flex-1">
            <div className="h-4 bg-white/10 rounded w-24 mb-2" />
            <div className="h-3 bg-white/10 rounded w-16" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-red-500/10 border border-red-500/20 rounded-xl p-4 ${className}`}>
        <div className="flex items-center gap-2 text-red-400">
          <AlertCircle className="w-5 h-5" />
          <span className="text-sm">{error}</span>
        </div>
      </div>
    );
  }

  if (!gasEstimate) return null;

  if (compact) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Fuel className="w-4 h-4 text-blue-400" />
        <span className="text-sm font-medium text-white">
          {gasEstimate.formatted || `${gasEstimate.gasPrice} ${gasEstimate.gasPriceUnit}`}
        </span>
        {getTrendIcon()}
      </div>
    );
  }

  return (
    <div className={`bg-white/5 border border-white/10 rounded-xl p-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-blue-500/10 rounded-lg">
            <Fuel className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white capitalize">{chain}</h3>
            <p className="text-xs text-gray-400">{network}</p>
          </div>
        </div>
        <div className={`text-xs px-2 py-1 rounded-full bg-white/5 ${getConfidenceColor(gasEstimate.confidence)}`}>
          {gasEstimate.confidence}% confidence
        </div>
      </div>

      {/* Gas Price */}
      <div className="mb-4">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-white">
            {gasEstimate.formatted || `${gasEstimate.gasPrice} ${gasEstimate.gasPriceUnit}`}
          </span>
          {getTrendIcon()}
        </div>
        <p className="text-xs text-gray-400 mt-1">
          Source: {gasEstimate.source} • Est. time: {formatTime(gasEstimate.estimatedTimeSeconds)}
        </p>
      </div>

      {/* EIP-1559 Details */}
      {gasEstimate.baseFee && (
        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="bg-white/5 rounded-lg p-2">
            <p className="text-xs text-gray-400">Base Fee</p>
            <p className="text-sm font-medium text-white">{gasEstimate.baseFee} Gwei</p>
          </div>
          {gasEstimate.priorityFee && (
            <div className="bg-white/5 rounded-lg p-2">
              <p className="text-xs text-gray-400">Priority Fee</p>
              <p className="text-sm font-medium text-white">{gasEstimate.priorityFee} Gwei</p>
            </div>
          )}
        </div>
      )}

      {/* Prediction */}
      {showPrediction && prediction && (
        <div className="border-t border-white/10 pt-3 mb-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">1h Prediction</span>
            <div className="flex items-center gap-1">
              {getTrendIcon()}
              <span className={`text-sm font-medium ${
                prediction.trend === 'falling' ? 'text-green-400' : 
                prediction.trend === 'rising' ? 'text-red-400' : 'text-yellow-400'
              }`}>
                {prediction.predictedPrice} Gwei
              </span>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {prediction.confidence}% confidence • Trend: {prediction.trend}
          </p>
        </div>
      )}

      {/* Optimization Recommendation */}
      {showOptimization && optimization && optimization.canOptimize && (
        <div className="border-t border-white/10 pt-3">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="w-4 h-4 text-green-400" />
            <span className="text-sm font-medium text-green-400">
              Save {optimization.savings.percent.toFixed(1)}%
            </span>
          </div>
          <p className="text-xs text-gray-400">
            {optimization.method === 'token' && `Use ${optimization.gasToken} for discount`}
            {optimization.method === 'timing' && 'Wait for lower gas prices'}
            {optimization.method === 'batching' && 'Batch with other transactions'}
          </p>
          {optimization.estimatedExecutionTime && (
            <p className="text-xs text-gray-500 mt-1">
              Est. execution: {optimization.estimatedExecutionTime.toLocaleTimeString()}
            </p>
          )}
        </div>
      )}

      {/* Refresh indicator */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/10">
        <span className="text-xs text-gray-500">
          Updated {gasEstimate.timestamp 
            ? new Date(gasEstimate.timestamp).toLocaleTimeString() 
            : new Date().toLocaleTimeString()}
        </span>
        <button
          onClick={fetchGasData}
          disabled={loading}
          className="text-xs text-blue-400 hover:text-blue-300 disabled:opacity-50"
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>
    </div>
  );
}
