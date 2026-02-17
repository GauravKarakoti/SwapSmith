'use client'

import { useState, useEffect, useCallback } from 'react';
import { ReputationMetrics } from '@/lib/database';

interface UseReputationOptions {
  enabled?: boolean;
  refetchInterval?: number;
  onSuccess?: (data: ReputationMetrics) => void;
  onError?: (error: Error) => void;
}

interface UseReputationResult {
  data: ReputationMetrics | null;
  isLoading: boolean;
  error: Error | null;
  isRefetching: boolean;
  refetch: () => Promise<void>;
}

export function useReputation(
  userId?: string | null,
  walletAddress?: string | null,
  options?: UseReputationOptions
): UseReputationResult {
  const [data, setData] = useState<ReputationMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isRefetching, setIsRefetching] = useState(false);

  const enabled = options?.enabled !== false;
  const refetchInterval = options?.refetchInterval || 0;

  const fetchReputation = useCallback(async (isRefetch = false) => {
    // Don't fetch if no ID is provided or if disabled
    if (!enabled || (!userId && !walletAddress)) {
      setIsLoading(false);
      return;
    }

    try {
      if (isRefetch) {
        setIsRefetching(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      const params = new URLSearchParams();
      if (userId) params.append('userId', userId);
      if (walletAddress) params.append('walletAddress', walletAddress);

      const response = await fetch(`/api/reputation?${params.toString()}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch reputation: ${response.statusText}`);
      }

      const jsonData = await response.json();

      if (!jsonData.success) {
        throw new Error(jsonData.error || 'Failed to fetch reputation metrics');
      }

      setData(jsonData.data || null);
      options?.onSuccess?.(jsonData.data);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      options?.onError?.(error);
      console.error('Error fetching reputation:', error);
    } finally {
      if (isRefetch) {
        setIsRefetching(false);
      } else {
        setIsLoading(false);
      }
    }
  }, [userId, walletAddress, enabled, options]);

  // Initial fetch and refetch interval setup
  useEffect(() => {
    if (!enabled) return;

    // Initial fetch
    fetchReputation(false);

    // Set up refetch interval if specified
    if (refetchInterval > 0) {
      const interval = setInterval(() => {
        fetchReputation(true);
      }, refetchInterval);

      return () => clearInterval(interval);
    }
  }, [fetchReputation, enabled, refetchInterval]);

  // Manual refetch function
  const refetch = useCallback(async () => {
    await fetchReputation(true);
  }, [fetchReputation]);

  return {
    data,
    isLoading,
    error,
    isRefetching,
    refetch,
  };
}
