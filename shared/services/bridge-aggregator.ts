/**
 * Bridge Aggregator Service
 * Aggregates, normalizes, scores, and routes quotes across multiple bridge protocols.
 */

import {
  BridgeQuote,
  BridgeQuoteRequest,
  BridgeOrderRequest,
  BridgeOrder,
  BaseBridgeAdapter,
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
 * Safely converts string/number amounts to Number for float comparisons
 */
function safeParseFloat(val: string | number | undefined | null, fallback = 0): number {
  if (val === undefined || val === null) return fallback;
  const parsed = typeof val === 'number' ? val : parseFloat(val);
  return isNaN(parsed) ? fallback : parsed;
}

/**
 * Bridge Aggregator Class
 * Collects and normalizes quotes from multiple bridge protocols
 */
export class BridgeAggregator {
  private adapters: Map<string, BaseBridgeAdapter>;
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
        this.adapters.set(name.toLowerCase(), adapter);
      }
    }
  }

  /**
   * Get quotes from all available bridges
   */
  async getQuotes(request: BridgeQuoteRequestWithPrefs): Promise<AggregatedQuote> {
    const errors = new Map<string, string>();
    const quotes: BridgeQuote[] = [];

    // Determine which bridges to query
    const bridgesToQuery = this.getBridgesToQuery(request);

    // Get quotes from all bridges in parallel
    const quotePromises = bridgesToQuery.map(async (bridgeName) => {
      try {
        const adapter = this.adapters.get(bridgeName.toLowerCase());
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

    // Sort quotes by output amount
    const sortedByOutput = this.sortByOutput(quotes);

    // Create fallback if no quotes retrieved
    const fallbackQuote = this.createFallbackQuote(request);
    const bestQuote = sortedByOutput[0] || fallbackQuote;

    const recommendedQuote =
      quotes.length > 0
        ? this.getRecommendedQuote(
            quotes,
            request.preferences || this.defaultPreferences
          )
        : fallbackQuote;

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
      throw new Error(`Bridge ${bridgeName} is not supported or adapter missing`);
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
      throw new Error(`Bridge ${bridgeName} is not supported or adapter missing`);
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
    // If specific bridges are explicitly included, use those
    if (request.includeBridges && request.includeBridges.length > 0) {
      return request.includeBridges.map((b) => b.toLowerCase());
    }

    // Otherwise get standard available bridges for this route
    let bridges = getAvailableBridges(request.fromChain, request.toChain);

    // If specific bridges are excluded, filter them out
    if (request.excludeBridges && request.excludeBridges.length > 0) {
      const excluded = new Set(request.excludeBridges.map((b) => b.toLowerCase()));
      bridges = bridges.filter((b) => !excluded.has(b.toLowerCase()));
    }

    // Apply user preferences
    const prefs = request.preferences || this.defaultPreferences;

    if (prefs.preferredBridges && prefs.preferredBridges.length > 0) {
      const preferred = new Set(prefs.preferredBridges.map((b) => b.toLowerCase()));
      const filtered = bridges.filter((b) => preferred.has(b.toLowerCase()));
      if (filtered.length > 0) {
        bridges = filtered;
      }
    }

    if (prefs.avoidBridges && prefs.avoidBridges.length > 0) {
      const avoided = new Set(prefs.avoidBridges.map((b) => b.toLowerCase()));
      bridges = bridges.filter((b) => !avoided.has(b.toLowerCase()));
    }

    // Filter by instant execution if requested
    if (prefs.instantOnly) {
      bridges = bridges.filter((b) => {
        const config = BRIDGE_CONFIGS[b.toLowerCase()];
        return config?.features?.instantExecution ?? false;
      });
    }

    return bridges;
  }

  /**
   * Sort quotes by output amount (descending)
   */
  private sortByOutput(quotes: BridgeQuote[]): BridgeQuote[] {
    return [...quotes].sort((a, b) => {
      const aAmount = safeParseFloat(a.toAmount);
      const bAmount = safeParseFloat(b.toAmount);
      return bAmount - aAmount;
    });
  }

  /**
   * Sort quotes by total fee (ascending)
   */
  private sortByFee(quotes: BridgeQuote[]): BridgeQuote[] {
    return [...quotes].sort((a, b) => {
      const aFee = safeParseFloat(a.totalFee);
      const bFee = safeParseFloat(b.totalFee);
      return aFee - bFee;
    });
  }

  /**
   * Sort quotes by execution time (ascending)
   */
  private sortByTime(quotes: BridgeQuote[]): BridgeQuote[] {
    return [...quotes].sort((a, b) => {
      const aTime = a.estimatedTime?.max ?? 60;
      const bTime = b.estimatedTime?.max ?? 60;
      return aTime - bTime;
    });
  }

  private getRecommendedQuote(
    quotes: BridgeQuote[],
    preferences: BridgePreferences
  ): BridgeQuote {
    if (quotes.length === 0) {
      throw new Error('No quotes available');
    }

    switch (preferences.priority) {
      case 'cost':
        return this.sortByFee(quotes)[0]!;

      case 'speed':
        return this.sortByTime(quotes)[0]!;

      case 'reliability':
        return [...quotes].sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))[0]!;

      case 'balanced':
      default:
        return this.scoreQuotes(quotes, preferences)[0]!;
    }
  }

  /**
   * Score quotes based on balanced criteria
   */
  private scoreQuotes(
    quotes: BridgeQuote[],
    _preferences: BridgePreferences
  ): BridgeQuote[] {
    if (quotes.length === 0) return [];

    const outputs = quotes.map((q) => safeParseFloat(q.toAmount));
    const fees = quotes.map((q) => safeParseFloat(q.totalFee));
    const times = quotes.map((q) => q.estimatedTime?.max ?? 60);

    const maxOutput = Math.max(...outputs);
    const minFee = Math.min(...fees);
    const maxFee = Math.max(...fees);
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);

    const scored = quotes.map((quote) => {
      let score = 0;

      // 1. Output amount score (0-40 points)
      const currentOutput = safeParseFloat(quote.toAmount);
      const outputScore = maxOutput > 0 ? (currentOutput / maxOutput) * 40 : 0;
      score += outputScore;

      // 2. Fee score (0-25 points - lower is better)
      const currentFee = safeParseFloat(quote.totalFee);
      let feeScore = 25;
      if (maxFee > minFee) {
        feeScore = (1 - (currentFee - minFee) / (maxFee - minFee)) * 25;
      }
      score += Math.max(0, feeScore);

      // 3. Speed score (0-20 points - lower is better)
      const currentTime = quote.estimatedTime?.max ?? 60;
      let timeScore = 20;
      if (maxTime > minTime) {
        timeScore = (1 - (currentTime - minTime) / (maxTime - minTime)) * 20;
      }
      score += Math.max(0, timeScore);

      // 4. Reliability score (0-15 points)
      const confidence = quote.confidence ?? 100;
      score += (confidence / 100) * 15;

      return { quote, score };
    });

    return scored.sort((a, b) => b.score - a.score).map((s) => s.quote);
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

// Export convenience helper functions
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