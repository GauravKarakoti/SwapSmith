import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchWithCache, CACHE_CONFIGS, invalidateCache } from '@/lib/cache-utils';
import { CoinPrice } from '@/utils/sideshift-client';

// API Response types
interface CachedPricesResponse {
  prices: CoinPrice[];
  cached: boolean;
  count: number;
  timestamp: string;
}

interface SwapHistoryItem {
  id: string;
  userId: string;
  walletAddress?: string;
  depositCoin?: string;
  settleCoin?: string;
  depositAmount?: string;
  settleAmount?: string;
  status?: string;
  createdAt: string;
}

interface SwapHistoryResponse {
  history: SwapHistoryItem[];
  count: number;
}

interface UserSettingsResponse {
  userId: string;
  preferences?: string;
  emailNotifications?: string;
  updatedAt: string;
}

interface ChatMessage {
  id: string;
  userId: string;
  sessionId?: string;
  role: string;
  content: string;
  createdAt: string;
}

interface ChatHistoryResponse {
  history: ChatMessage[];
  count: number;
}

interface ChatSession {
  sessionId: string;
  title: string;
  lastMessage: string;
  timestamp: string;
  messageCount: number;
}

interface ChatSessionsResponse {
  sessions: ChatSession[];
  count: number;
}

interface UseCachedDataOptions<T> {
  enabled?: boolean;
  refetchInterval?: number;
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
}

export function useCachedData<T>(
  url: string,
  options?: UseCachedDataOptions<T>
) {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isRefetching, setIsRefetching] = useState(false);

  // Use refs for callbacks to avoid infinite loops
  const onSuccessRef = useRef(options?.onSuccess);
  const onErrorRef = useRef(options?.onError);
  
  useEffect(() => {
    onSuccessRef.current = options?.onSuccess;
    onErrorRef.current = options?.onError;
  }, [options?.onSuccess, options?.onError]);

  const fetchData = useCallback(async (isRefetch = false) => {
    if (!url) return; // Don't fetch if URL is empty
    
    try {
      if (isRefetch) {
        setIsRefetching(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      const result = await fetchWithCache<T>(url, {}, CACHE_CONFIGS.PRICES);
      setData(result);
      
      if (onSuccessRef.current) {
        onSuccessRef.current(result);
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      
      if (onErrorRef.current) {
        onErrorRef.current(error);
      }
    } finally {
      setIsLoading(false);
      setIsRefetching(false);
    }
  }, [url]);

  useEffect(() => {
    if (options?.enabled === false || !url) {
      setIsLoading(false);
      return;
    }

    fetchData();

    // Set up refetch interval if provided
    if (options?.refetchInterval) {
      const interval = setInterval(() => {
        fetchData(true);
      }, options.refetchInterval);

      return () => clearInterval(interval);
    }
  }, [url, options?.enabled, options?.refetchInterval, fetchData]);

  const refetch = useCallback(() => {
    invalidateCache(url);
    return fetchData(true);
  }, [url, fetchData]);

  const mutate = useCallback((newData?: T) => {
    if (newData !== undefined) {
      setData(newData);
    }
    return refetch();
  }, [refetch]);

  return {
    data,
    isLoading,
    error,
    isRefetching,
    refetch,
    mutate,
  };
}

// Specialized hooks for different data types

export function useCachedPrices(coin?: string, network?: string) {
  const url = coin && network 
    ? `/api/prices?coin=${coin}&network=${network}`
    : '/api/prices';

  return useCachedData<CachedPricesResponse>(url, {
    refetchInterval: 6 * 60 * 60 * 1000, // Refetch every 6 hours
  });
}

export function useSwapHistory(userId?: string, walletAddress?: string) {
  const url = userId 
    ? `/api/history?userId=${userId}`
    : walletAddress 
    ? `/api/history?wallet=${walletAddress}`
    : null;

  return useCachedData<SwapHistoryResponse>(url || '', {
    enabled: !!url,
    refetchInterval: 30 * 1000, // Refetch every 30 seconds
  });
}

export function useUserSettings(userId?: string) {
  const url = userId ? `/api/user/settings?userId=${userId}` : null;

  return useCachedData<UserSettingsResponse>(url || '', {
    enabled: !!url,
  });
}

export function useChatHistory(userId?: string, sessionId?: string) {
  const url = userId 
    ? sessionId 
      ? `/api/chat/history?userId=${userId}&sessionId=${sessionId}`
      : `/api/chat/history?userId=${userId}`
    : null;

  return useCachedData<ChatHistoryResponse>(url || '', {
    enabled: !!url,
    refetchInterval: 10 * 1000, // Refetch every 10 seconds for active chat
  });
}

export function useChatSessions(userId?: string) {
  const url = userId ? `/api/chat/sessions?userId=${userId}` : null;

  return useCachedData<ChatSessionsResponse>(url || '', {
    enabled: !!url,
    refetchInterval: 30 * 1000, // Refetch every 30 seconds
  });
}
