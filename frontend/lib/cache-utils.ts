/**
 * Cache utilities for managing cached data with TTL
 */

export interface CacheConfig {
  ttl: number; // Time to live in milliseconds
  staleWhileRevalidate?: number; // Additional time to serve stale data while revalidating
}

export const CACHE_CONFIGS = {
  PRICES: {
    ttl: 6 * 60 * 60 * 1000, // 6 hours
    staleWhileRevalidate: 1 * 60 * 60 * 1000, // 1 hour
  },
  USER_SETTINGS: {
    ttl: 10 * 60 * 1000, // 10 minutes
    staleWhileRevalidate: 15 * 60 * 1000, // 15 minutes
  },
  SWAP_HISTORY: {
    ttl: 2 * 60 * 1000, // 2 minutes
    staleWhileRevalidate: 5 * 60 * 1000, // 5 minutes
  },
  CHAT_HISTORY: {
    ttl: 30 * 1000, // 30 seconds
    staleWhileRevalidate: 60 * 1000, // 1 minute
  },
} as const;

/**
 * Fetch with cache support
 */
export async function fetchWithCache<T>(
  url: string,
  options?: RequestInit,
  config: CacheConfig = CACHE_CONFIGS.PRICES
): Promise<T> {
  const cacheKey = `cache_${url}`;
  
  // Check if we're in browser
  if (typeof window === 'undefined') {
    const response = await fetch(url, options);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  }

  // Try to get from localStorage cache
  const cached = localStorage.getItem(cacheKey);
  if (cached) {
    try {
      const { data, expiresAt } = JSON.parse(cached);
      const now = Date.now();
      
      // If cache is still fresh, return it
      if (now < expiresAt) {
        return data as T;
      }
      
      // If within stale-while-revalidate window, return stale data and revalidate in background
      if (config.staleWhileRevalidate && now < expiresAt + config.staleWhileRevalidate) {
        // Revalidate in background (don't await)
        revalidateCache(url, options, config, cacheKey);
        return data as T;
      }
    } catch (error) {
      console.error('Error parsing cache:', error);
      localStorage.removeItem(cacheKey);
    }
  }

  // Cache miss or expired - fetch fresh data
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  
  const data = await response.json();
  
  // Store in cache
  const cacheEntry = {
    data,
    timestamp: Date.now(),
    expiresAt: Date.now() + config.ttl,
  };
  
  try {
    localStorage.setItem(cacheKey, JSON.stringify(cacheEntry));
  } catch (error) {
    console.error('Error storing cache:', error);
  }
  
  return data as T;
}

/**
 * Revalidate cache in background
 */
async function revalidateCache(
  url: string,
  options: RequestInit | undefined,
  config: CacheConfig,
  cacheKey: string
) {
  try {
    const response = await fetch(url, options);
    if (!response.ok) return;
    
    const data = await response.json();
    
    const cacheEntry = {
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + config.ttl,
    };
    
    localStorage.setItem(cacheKey, JSON.stringify(cacheEntry));
  } catch (error) {
    console.error('Error revalidating cache:', error);
  }
}

/**
 * Invalidate cache for a specific URL
 */
export function invalidateCache(url: string) {
  const cacheKey = `cache_${url}`;
  if (typeof window !== 'undefined') {
    localStorage.removeItem(cacheKey);
  }
}

/**
 * Clear all cache
 */
export function clearAllCache() {
  if (typeof window !== 'undefined') {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith('cache_')) {
        localStorage.removeItem(key);
      }
    });
  }
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  if (typeof window === 'undefined') return null;
  
  const keys = Object.keys(localStorage);
  const cacheKeys = keys.filter(key => key.startsWith('cache_'));
  
  let totalSize = 0;
  let validCount = 0;
  let expiredCount = 0;
  
  cacheKeys.forEach(key => {
    try {
      const cached = localStorage.getItem(key);
      if (cached) {
        totalSize += cached.length;
        const { expiresAt } = JSON.parse(cached);
        if (Date.now() < expiresAt) {
          validCount++;
        } else {
          expiredCount++;
        }
      }
    } catch {
      // Ignore parse errors
    }
  });
  
  return {
    totalCacheEntries: cacheKeys.length,
    validEntries: validCount,
    expiredEntries: expiredCount,
    totalSizeBytes: totalSize,
    totalSizeKB: (totalSize / 1024).toFixed(2),
  };
}

/**
 * Clean expired cache entries
 */
export function cleanExpiredCache(): number {
  if (typeof window === 'undefined') return 0;
  
  const keys = Object.keys(localStorage);
  const cacheKeys = keys.filter(key => key.startsWith('cache_'));
  
  let cleanedCount = 0;
  
  cacheKeys.forEach(key => {
    try {
      const cached = localStorage.getItem(key);
      if (cached) {
        const { expiresAt } = JSON.parse(cached);
        if (Date.now() >= expiresAt) {
          localStorage.removeItem(key);
          cleanedCount++;
        }
      }
    } catch {
      // Remove invalid entries
      localStorage.removeItem(key);
      cleanedCount++;
    }
  });
  
  return cleanedCount;
}
