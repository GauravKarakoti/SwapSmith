'use client'

import { useReputation } from '@/hooks/useReputation';
import { Shield, TrendingUp, CheckCircle, Clock, ArrowUpRight, Zap } from 'lucide-react';
import { useState, useEffect } from 'react';

interface ReputationCardProps {
  userId?: string | null;
  walletAddress?: string | null;
  compact?: boolean;
  showDetails?: boolean;
}

export function ReputationCard({ 
  userId, 
  walletAddress, 
  compact = false,
  showDetails = true 
}: ReputationCardProps) {
  const { data: reputation, isLoading, error } = useReputation(userId, walletAddress);
  const [trustColor, setTrustColor] = useState('text-gray-400');
  const [trustBgColor, setTrustBgColor] = useState('bg-gray-500/20');
  const [trustBorderColor, setTrustBorderColor] = useState('border-gray-500/30');

  // Update colors based on trust score
  useEffect(() => {
    if (!reputation) return;

    const score = reputation.trustScore;
    if (score >= 80) {
      setTrustColor('text-emerald-400');
      setTrustBgColor('bg-emerald-500/20');
      setTrustBorderColor('border-emerald-500/30');
    } else if (score >= 60) {
      setTrustColor('text-cyan-400');
      setTrustBgColor('bg-cyan-500/20');
      setTrustBorderColor('border-cyan-500/30');
    } else if (score >= 40) {
      setTrustColor('text-yellow-400');
      setTrustBgColor('bg-yellow-500/20');
      setTrustBorderColor('border-yellow-500/30');
    } else if (score > 0) {
      setTrustColor('text-orange-400');
      setTrustBgColor('bg-orange-500/20');
      setTrustBorderColor('border-orange-500/30');
    }
  }, [reputation]);

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-5 backdrop-blur-sm">
        <p className="text-red-400 text-sm">Failed to load reputation data</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={`bg-white/[0.03] border border-white/10 rounded-2xl backdrop-blur-sm animate-pulse ${
        compact ? 'p-4' : 'p-6'
      }`}>
        <div className="h-8 bg-gray-700 rounded w-1/3 mb-4" />
        <div className="h-20 bg-gray-700 rounded w-full" />
      </div>
    );
  }

  if (!reputation) {
    return (
      <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
        <p className="text-gray-400 text-sm">No reputation data available</p>
      </div>
    );
  }

  const getTrustLabel = (score: number) => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    if (score > 0) return 'Building';
    return 'New User';
  };

  const getActivityEmoji = (activity: string) => {
    switch (activity) {
      case 'active': return '🔥';
      case 'moderate': return '📊';
      default: return '⏱️';
    }
  };

  if (compact) {
    return (
      <div className={`bg-white/[0.03] border ${trustBorderColor} ${trustBgColor} rounded-2xl p-4 backdrop-blur-sm`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-lg bg-white/5`}>
              <Shield className={`w-5 h-5 ${trustColor}`} />
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Trust Score</p>
              <p className={`text-2xl font-bold ${trustColor}`}>{reputation.trustScore}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500 uppercase font-semibold">{getTrustLabel(reputation.trustScore)}</p>
            <p className={`text-sm font-bold ${trustColor}`}>{reputation.successRate.toFixed(1)}%</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white/[0.03] border ${trustBorderColor} ${trustBgColor} rounded-2xl p-6 backdrop-blur-sm`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className={`p-3 bg-white/5 rounded-lg`}>
            <Shield className={`w-6 h-6 ${trustColor}`} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-tight">Agent Reputation</h3>
            <p className="text-xs text-gray-500 mt-1">On-Chain Trading Reliability</p>
          </div>
        </div>
        <span className={`text-xs font-black uppercase tracking-widest ${trustBgColor} ${trustColor} px-3 py-1.5 rounded-md border ${trustBorderColor}`}>
          {getTrustLabel(reputation.trustScore)}
        </span>
      </div>

      {/* Trust Score Display */}
      <div className="mb-6 p-4 bg-black/20 rounded-xl border border-white/5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-gray-400 uppercase font-semibold">Trust Score</span>
          <span className={`text-xs font-bold ${trustColor}`}>{reputation.recentActivity === 'active' && getActivityEmoji(reputation.recentActivity)}</span>
        </div>
        <div className="flex items-baseline gap-2 mb-3">
          <span className={`text-4xl font-black ${trustColor}`}>{reputation.trustScore}</span>
          <span className="text-gray-400 text-sm">/100</span>
        </div>
        {/* Progress bar */}
        <div className="w-full bg-gray-800 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-500 ${
              reputation.trustScore >= 80 ? 'bg-emerald-500' :
              reputation.trustScore >= 60 ? 'bg-cyan-500' :
              reputation.trustScore >= 40 ? 'bg-yellow-500' :
              'bg-orange-500'
            }`}
            style={{ width: `${reputation.trustScore}%` }}
          />
        </div>
      </div>

      {/* Detailed Metrics Grid */}
      {showDetails && (
        <div className="grid grid-cols-2 gap-4 mb-6">
          {/* Success Rate */}
          <div className="bg-black/20 rounded-lg p-3 border border-white/5">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <span className="text-xs text-gray-400 uppercase font-semibold">Success Rate</span>
            </div>
            <p className="text-2xl font-bold text-white">{reputation.successRate.toFixed(1)}%</p>
            <p className="text-xs text-gray-500 mt-1">
              {reputation.successfulSwaps}/{reputation.totalSwaps} swaps
            </p>
          </div>

          {/* Total Swaps */}
          <div className="bg-black/20 rounded-lg p-3 border border-white/5">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-cyan-400" />
              <span className="text-xs text-gray-400 uppercase font-semibold">Total Swaps</span>
            </div>
            <p className="text-2xl font-bold text-white">{reputation.totalSwaps}</p>
            <p className="text-xs text-gray-500 mt-1">
              {reputation.pendingSwaps} pending
            </p>
          </div>

          {/* Total Volume */}
          <div className="bg-black/20 rounded-lg p-3 border border-white/5">
            <div className="flex items-center gap-2 mb-2">
              <ArrowUpRight className="w-4 h-4 text-purple-400" />
              <span className="text-xs text-gray-400 uppercase font-semibold">Total Volume</span>
            </div>
            <p className="text-2xl font-bold text-white">${reputation.totalVolumeSwapped.toLocaleString('en-US', { maximumFractionDigits: 2 })}</p>
            <p className="text-xs text-gray-500 mt-1">
              Avg: ${reputation.avgSwapValue.toLocaleString('en-US', { maximumFractionDigits: 2 })}
            </p>
          </div>

          {/* Activity Status */}
          <div className="bg-black/20 rounded-lg p-3 border border-white/5">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-blue-400" />
              <span className="text-xs text-gray-400 uppercase font-semibold">Activity</span>
            </div>
            <p className="text-2xl font-bold text-white capitalize">{reputation.recentActivity}</p>
            {reputation.lastSwapDate && (
              <p className="text-xs text-gray-500 mt-1">
                Last: {getTimeAgo(new Date(reputation.lastSwapDate))}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Footer Stats */}
      <div className="pt-4 border-t border-white/5 flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-xs text-gray-500 uppercase font-semibold">Status Breakdown</p>
          <div className="flex gap-4">
            <span className="text-xs">
              <span className="text-emerald-400 font-bold">{reputation.successfulSwaps}</span>
              <span className="text-gray-500"> completed</span>
            </span>
            <span className="text-xs">
              <span className="text-orange-400 font-bold">{reputation.failedSwaps}</span>
              <span className="text-gray-500"> failed</span>
            </span>
          </div>
        </div>
        <div className="text-right">
          {reputation.trustScore >= 80 && (
            <div className="flex items-center gap-1 text-emerald-400 text-xs font-bold">
              <Zap className="w-3.5 h-3.5" />
              <span>Top Tier</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Helper function to format time
function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 30) return `${diffDays}d ago`;
  
  const diffMonths = Math.floor(diffDays / 30);
  return `${diffMonths}mo ago`;
}
