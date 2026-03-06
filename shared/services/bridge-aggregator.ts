/**
 * Bridge Aggregator Service
 * Aggregates quotes from multiple bridge protocols
 */

import {
  BridgeQuote,
  BridgeQuoteRequest,
  BridgeOrderRequest,
  BridgeOrder,
  createAdapter,
} from './bridges';
import {
  BridgePreferences,
  DEFAULT_BRIDGE_PREFERENCES,
  getAvailableBridges,
  BridgeConfig,
  BRIDGE_CONFIGS,
} from '../config/bridge-config';

// Aggregated quote result
export interface AggregatedQuote {
  quotes: BridgeQuote[];
  bestQuote: BridgeQuote;
  recommendedQuote: BridgeQuote;
  availableBridges: string[];
  errors: Map<string, string>;
  timestamp: string;
}

// Quote request with preferences
export interface BridgeQuoteRequestWithPrefs extends BridgeQuoteRequest {
  preferences?: BridgePreferences;
  excludeBridges?: string[];
  includeBridges?: string[];
}

/**
 * Bridge Aggregator Class
 * Collects and normalizes quotes from multiple bridge protocols
 */
export class BridgeAggregator {
  private adapters: Map<string, any>;
  private defaultPreferences: BridgePreferences;

  constructor() {
    this.adapters = new Map();
    this.defaultPreferences = DEFAULT_BRIDGE_PREFERENCES;
    this.initializeAdapters();
  }

  /**
   * Initialize all available adapters
   */
  private initializeAdapters(): void {
    const bridgeNames = ['across', 'stargate', 'layerzero', 'wormhole'];
    
    for (const name of bridgeNames) {
      const adapter = createAdapter(name);
      if (adapter) {
        this.adapters.set(name, adapter);
      }
    }
  }

  /**
   * Get quotes from all available bridges
   */
  async getQuotes(request: BridgeQuoteRequestWithPrefs): Promise<AggregatedQuote> {
    const errors = new Map<string, string>();
    const quotes: BridgeQuote[] = [];
    const startTime = Date.now();

    // Determine which bridges to query
    const bridgesToQuery = this.getBridgesToQuery(request);
    
    // Get quotes from all bridges in parallel
    const quotePromises = bridgesToQuery.map(async (bridgeName) => {
      try {
        const adapter = this.adapters.get(bridgeName);
        if (!adapter) {
          throw new Error(`Adapter not found for ${bridgeName}`);
        }

        const quote = await adapter.getQuote(request);
        return { bridgeName, quote, error: null };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        errors.set(bridgeName, errorMsg);
        return { bridgeName, quote: null, error: errorMsg };
      }
    });

    const results = await Promise.allSettled(quotePromises);

    // Process results
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value.quote) {
        quotes.push(result.value.quote);
      }
    }

    // Sort quotes by different criteria
    const sortedByOutput = this.sortByOutput(quotes);
    const sortedByFee = this.sortByFee(quotes);
    const sortedByTime = this.sortByTime(quotes);

    // Get best quote based on preferences
    const bestQuote = sortedByOutput[0] || this.createFallbackQuote(request);
    const recommendedQuote = this.getRecommendedQuote(
      quotes,
      request.preferences || this.defaultPreferences
    );

    const availableBridges = getAvailableBridges(request.fromChain, request.toChain);

    return {
      quotes,
      bestQuote,
      recommendedQuote,
      availableBridges,
      errors,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get a single bridge quote
   */
  async getSingleQuote(
    bridgeName: string,
    request: BridgeQuoteRequest
  ): Promise<BridgeQuote> {
    const adapter = this.adapters.get(bridgeName.toLowerCase());
    
    if (!adapter) {
      throw new Error(`Bridge ${bridgeName} is not supported`);
    }

    return adapter.getQuote(request);
  }

  /**
   * Create an order with a specific bridge
   */
  async createOrder(
    bridgeName: string,
    request: BridgeOrderRequest
  ): Promise<BridgeOrder> {
    const adapter = this.adapters.get(bridgeName.toLowerCase());
    
    if (!adapter) {
      throw new Error(`Bridge ${bridgeName} is not supported`);
    }

    return adapter.createOrder(request);
  }

  /**
   * Get supported bridges for a route
   */
  getSupportedBridges(fromChain: string, toChain: string): string[] {
    const bridges: string[] = [];
    
    for (const [name, adapter] of this.adapters) {
      if (adapter.supportsRoute(fromChain, toChain)) {
        bridges.push(name);
      }
    }
    
    return bridges;
  }

  /**
   * Get bridge configuration
   */
  getBridgeConfig(bridgeName: string): BridgeConfig | undefined {
    return BRIDGE_CONFIGS[bridgeName.toLowerCase()];
  }

  /**
   * Determine which bridges to query
   */
  private getBridgesToQuery(request: BridgeQuoteRequestWithPrefs): string[] {
    // If specific bridges are requested, use those
    if (request.includeBridges && request.includeBridges.length > 0) {
      return request.includeBridges;
    }

    // If specific bridges are excluded, filter them out
    let bridges = getAvailableBridges(request.fromChain, request.toChain);
    
    if (request.excludeBridges && request.excludeBridges.length > 0) {
      bridges = bridges.filter(b => !request.excludeBridges!.includes(b));
    }

    // Apply user preferences
    const prefs = request.preferences || this.defaultPreferences;
    
    if (prefs.preferredBridges.length > 0) {
      bridges = bridges.filter(b => prefs.preferredBridges.includes(b));
    }
    
    if (prefs.avoidBridges.length > 0) {
      bridges = bridges.filter(b => !prefs.avoidBridges.includes(b));
    }

    // Filter by instant if requested
    if (prefs.instantOnly) {
      bridges = bridges.filter(b => {
        const config = BRIDGE_CONFIGS[b];
        return config?.features.instantExecution;
      });
    }

    return bridges;
  }

  /**
   * Sort quotes by output amount (descending)
   */
  private sortByOutput(quotes: BridgeQuote[]): BridgeQuote[] {
    return [...quotes].sort((a, b) => {
      const aAmount = BigInt(a.toAmount);
      const bAmount = BigInt(b.toAmount);
      return bAmount > aAmount ? 1 : bAmount < aAmount ? -1 : 0;
    });
  }

  /**
   * Sort quotes by total fee (ascending)
   */
  private sortByFee(quotes: BridgeQuote[]): BridgeQuote[] {
    return [...quotes].sort((a, b) => {
      const aFee = BigInt(a.totalFee || '0');
      const bFee = BigInt(b.totalFee || '0');
      return aFee < bFee ? -1 : aFee > bFee ? 1 : 0;
    });
  }

  /**
   * Sort quotes by execution time (ascending)
   */
  private sortByTime(quotes: BridgeQuote[]): BridgeQuote[] {
    return [...quotes].sort((a, b) => {
      const aTime = a.estimatedTime?.max || 60;
      const bTime = b.estimatedTime?.max || 60;
      return aTime - bTime;
    });
  }

  /**
   * Get recommended quote based on preferences
   */
  private getRecommendedQuote(
    quotes: BridgeQuote[],
    preferences: BridgePreferences
  ): BridgeQuote {
    if (quotes.length === 0) {
      throw new Error('No quotes available');
    }

    switch (preferences.priority) {
      case 'cost':
        return this.sortByFee(quotes)[0];
      
      case 'speed':
        return this.sortByTime(quotes)[0];
      
      case 'reliability':
        return [...quotes].sort((a, b) => b.confidence - a.confidence)[0];
      
      case 'balanced':
      default:
        // Score based on multiple factors
        return this.scoreQuotes(quotes, preferences)[0];
    }
  }

  /**
   * Score quotes based on multiple factors
   */
  private scoreQuotes(
    quotes: BridgeQuote[],
    preferences: BridgePreferences
  ): BridgeQuote[] {
    const scored = quotes.map(quote => {
      let score = 0;
      
      // Output amount score (0-40 points)
      const maxOutput = Math.max(...quotes.map(q => Number(q.toAmount)));
      const outputScore = maxOutput > 0 
        ? (Number(quote.toAmount) / maxOutput) * 40 
        : 0;
      score += outputScore;
      
      // Fee score (0-25 points)
      const minFee = Math.min(...quotes.map(q => Number(q.totalFee || '0')));
      const feeScore = quote.totalFee && Number(quote.totalFee) > 0
        ? (1 - Number(quote.totalFee) / Math.max(Number(quote.totalFee), minFee)) * 25
        : 25;
      score += feeScore;
      
      // Speed score (0-20 points)
      const minTime = Math.min(...quotes.map(q => q.estimatedTime?.max || 60));
      const timeScore = quote.estimatedTime?.max
        ? (1 - quote.estimatedTime.max / Math.max(quote.estimatedTime.max, minTime)) * 20
        : 10;
      score += timeScore;
      
      // Reliability score (0-15 points)
      score += (quote.confidence / 100) * 15;

      return { quote, score };
    });

    return scored
      .sort((a, b) => b.score - a.score)
      .map(s => s.quote);
  }

  /**
   * Create a fallback quote when no bridges return valid quotes
   */
  private createFallbackQuote(request: BridgeQuoteRequest): BridgeQuote {
    return {
      bridge: 'none',
      displayName: 'No Bridge Available',
      fromChain: request.fromChain,
      toChain: request.toChain,
      fromToken: request.fromToken,
      toToken: request.toToken,
      fromAmount: request.amount,
      toAmount: '0',
      rate: '0',
      gasEstimate: '0',
      gasFee: '0',
      bridgeFee: '0',
      totalFee: '0',
      estimatedTime: { min: 0, max: 0 },
      instant: false,
      confidence: 0,
    };
  }
}

// Export singleton instance
export const bridgeAggregator = new BridgeAggregator();

// Export convenience functions
export async function getAggregatedQuotes(
  request: BridgeQuoteRequestWithPrefs
): Promise<AggregatedQuote> {
  return bridgeAggregator.getQuotes(request);
}

export async function getSingleBridgeQuote(
  bridgeName: string,
  request: BridgeQuoteRequest
): Promise<BridgeQuote> {
  return bridgeAggregator.getSingleQuote(bridgeName, request);
}

export async function createBridgeOrder(
  bridgeName: string,
  request: BridgeOrderRequest
): Promise<BridgeOrder> {
  return bridgeAggregator.createOrder(bridgeName, request);
}

export function getSupportedBridgeList(fromChain: string, toChain: string): string[] {
  return bridgeAggregator.getSupportedBridges(fromChain, toChain);
}
