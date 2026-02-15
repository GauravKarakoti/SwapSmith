import { getCoins, SideShiftCoin } from './sideshift-client';

interface TokenInfo {
  address: string;
  decimals: number;
}

class TokenResolver {
  private cache: Map<string, TokenInfo> = new Map();
  private lastFetch: number = 0;
  private readonly CACHE_DURATION = 3600000; // 1 hour in milliseconds

  /**
   * Get token contract address and decimals for a given asset and network
   * @param asset - Token symbol (e.g., 'USDC', 'AVAX')
   * @param network - Network name (e.g., 'ethereum', 'avalanche')
   * @returns TokenInfo with address and decimals, or null if not found or native token
   */
  async getTokenInfo(asset: string, network: string): Promise<TokenInfo | null> {
    await this.ensureCacheLoaded();

    const cacheKey = `${asset.toUpperCase()}-${network.toLowerCase()}`;
    return this.cache.get(cacheKey) || null;
  }

  /**
   * Check if a token is a native token (doesn't need contract address)
   * @param asset - Token symbol
   * @param network - Network name
   * @returns true if it's a native token
   */
  async isNativeToken(asset: string, network: string): Promise<boolean> {
    await this.ensureCacheLoaded();
    
    const cacheKey = `${asset.toUpperCase()}-${network.toLowerCase()}`;
    // If not in cache, it's likely a native token
    return !this.cache.has(cacheKey);
  }

  /**
   * Ensure the cache is loaded and fresh
   */
  private async ensureCacheLoaded(): Promise<void> {
    const now = Date.now();
    
    // Refresh cache if it's empty or expired
    if (this.cache.size === 0 || now - this.lastFetch > this.CACHE_DURATION) {
      await this.refreshCache();
    }
  }

  /**
   * Refresh the token cache from SideShift API
   */
  private async refreshCache(): Promise<void> {
    try {
      const coins = await getCoins();
      this.cache.clear();

      for (const coin of coins) {
        if (coin.tokenDetails) {
          // tokenDetails is an object with network names as keys
          for (const [network, details] of Object.entries(coin.tokenDetails)) {
            const cacheKey = `${coin.coin.toUpperCase()}-${network.toLowerCase()}`;
            this.cache.set(cacheKey, {
              address: details.contractAddress,
              decimals: details.decimals
            });
          }
        }
        // Native tokens (like ETH, BTC, AVAX on their main chains) won't have tokenDetails
      }

      this.lastFetch = Date.now();
      console.log(`✅ Token cache refreshed: ${this.cache.size} tokens loaded`);
    } catch (error) {
      console.error('Failed to refresh token cache:', error);
      // Keep using old cache if refresh fails
    }
  }

  /**
   * Clear the cache (useful for testing)
   */
  clearCache(): void {
    this.cache.clear();
    this.lastFetch = 0;
  }
}

// Export singleton instance
export const tokenResolver = new TokenResolver();
