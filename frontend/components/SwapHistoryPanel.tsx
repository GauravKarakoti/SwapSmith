/**
 * SwapHistoryPanel Component
 * 
 * Displays user's swap history with real-time updates from the database
 * Uses the new caching system to reduce API calls
 */

'use client';

import { useSwapHistory } from '@/hooks/useCachedData';
import { useAuth } from '@/hooks/useAuth';
import { formatDistanceToNow } from 'date-fns';

interface SwapHistoryProps {
  userId?: string;
  walletAddress?: string;
  limit?: number;
}

export function SwapHistoryPanel({ userId, walletAddress, limit }: SwapHistoryProps) {
  const { user } = useAuth();
  const effectiveUserId = userId || user?.uid;
  
  const { data, isLoading, error, refetch } = useSwapHistory(effectiveUserId, walletAddress);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="animate-pulse bg-gray-800 rounded-lg p-4 h-24" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500 rounded-lg p-4">
        <p className="text-red-500">Failed to load swap history</p>
        <button
          onClick={() => refetch()}
          className="mt-2 text-sm text-red-400 hover:text-red-300"
        >
          Retry
        </button>
      </div>
    );
  }

  const swaps = data?.history || [];

  if (swaps.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-800/50 rounded-lg">
        <div className="text-4xl mb-4">📊</div>
        <h3 className="text-xl font-semibold mb-2">No Swap History</h3>
        <p className="text-gray-400">Your completed swaps will appear here</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Swap History</h2>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-400">
            {swaps.length} {swaps.length === 1 ? 'swap' : 'swaps'}
          </span>
          <button
            onClick={() => refetch()}
            className="text-sm text-blue-400 hover:text-blue-300"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Swap List */}
      <div className="space-y-3">
        {swaps.slice(0, limit).map((swap) => (
          <div
            key={swap.id}
            className="bg-gray-800 hover:bg-gray-750 rounded-lg p-4 transition-colors"
          >
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center gap-3">
                <div className="text-2xl">
                  {swap.depositCoin?.toUpperCase() || 'N/A'} → {swap.settleCoin?.toUpperCase() || 'N/A'}
                </div>
                <StatusBadge status={swap.status || 'pending'} />
              </div>
              <div className="text-right text-sm text-gray-400">
                {swap.createdAt && formatDistanceToNow(new Date(swap.createdAt), { addSuffix: true })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-400">From:</span>
                <div className="font-mono">
                  {swap.depositAmount || '0'} {swap.depositCoin?.toUpperCase() || 'N/A'}
                </div>
              </div>
              <div>
                <span className="text-gray-400">To:</span>
                <div className="font-mono">
                  {swap.settleAmount || '0'} {swap.settleCoin?.toUpperCase() || 'N/A'}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const statusConfig: Record<string, { color: string; emoji: string }> = {
    pending: { color: 'bg-yellow-500/20 text-yellow-400', emoji: '⏳' },
    processing: { color: 'bg-blue-500/20 text-blue-400', emoji: '⚡' },
    settling: { color: 'bg-purple-500/20 text-purple-400', emoji: '🔄' },
    settled: { color: 'bg-green-500/20 text-green-400', emoji: '✓' },
    failed: { color: 'bg-red-500/20 text-red-400', emoji: '✗' },
    refunded: { color: 'bg-orange-500/20 text-orange-400', emoji: '↩' },
  };

  const config = statusConfig[status] || statusConfig.pending;

  return (
    <span className={`px-2 py-1 rounded-full text-xs ${config.color}`}>
      {config.emoji} {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}


