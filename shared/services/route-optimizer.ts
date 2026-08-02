/**
 * Route Optimizer Service
 * Optimizes cross-chain routes based on user preferences, market conditions,
 * and historical bridge reliability.
 */

import { BridgeQuote } from './bridges';
import { BridgePreferences, DEFAULT_BRIDGE_PREFERENCES } from '../config/bridge-config';

// Route optimization result
export interface OptimizedRoute {
  quote: BridgeQuote;
  score: number;
  breakdown: {
    outputScore: number;
    feeScore: number;
    speedScore: number;
    reliabilityScore: number;
  };
  reasons: string[];
}

// Route comparison
export interface RouteComparison {
  routes: OptimizedRoute[];
  fastestRoute: OptimizedRoute;
  cheapestRoute: OptimizedRoute;
  bestValueRoute: OptimizedRoute;
  recommendedRoute: OptimizedRoute;
}

// Optimization options
export interface RouteOptimizationOptions {
  preferences?: BridgePreferences;
  maxSlippage?: number;
  excludeBridges?: string[];
  includeBridges?: string[];
}

/**
 * Safely parses values to prevent NaN propagation during scoring calculations
 */
function safeParseFloat(val: string | number | undefined | null, fallback = 0): number {
  if (val === undefined || val === null) return fallback;
  const parsed = typeof val === 'number' ? val : parseFloat(val);
  return isNaN(parsed) ? fallback : parsed;
}

/**
 * Route Optimizer Class
 * Analyzes, filters, and ranks cross-chain routes
 */
export class RouteOptimizer {
  /**
   * Optimize a list of quotes and return ranked routes
   */
  optimizeRoutes(
    quotes: BridgeQuote[],
    options: RouteOptimizationOptions = {}
  ): OptimizedRoute[] {
    const prefs = options.preferences || DEFAULT_BRIDGE_PREFERENCES;
    
    // Filter quotes based on options
    const filteredQuotes = this.filterQuotes(quotes, options);
    
    // Score each route
    const scoredRoutes = filteredQuotes.map(quote => 
      this.scoreRoute(quote, filteredQuotes, prefs)
    );
    
    // Sort by score (descending)
    return scoredRoutes.sort((a, b) => b.score - a.score);
  }

  compareRoutes(
    quotes: BridgeQuote[],
    options: RouteOptimizationOptions = {}
  ): RouteComparison {
    const optimizedRoutes = this.optimizeRoutes(quotes, options);
    
    // Graceful fallback for empty arrays to prevent frontend crashes
    if (optimizedRoutes.length === 0) {
      const fallbackRoute = this.createFallbackRoute(quotes[0]);
      return {
        routes: [],
        fastestRoute: fallbackRoute,
        cheapestRoute: fallbackRoute,
        bestValueRoute: fallbackRoute,
        recommendedRoute: fallbackRoute,
      };
    }

    const validQuotes = optimizedRoutes.map(opt => opt.quote);

    return {
      routes: optimizedRoutes,
      fastestRoute: this.findFastestRoute(validQuotes),
      cheapestRoute: this.findCheapestRoute(validQuotes),
      bestValueRoute: this.findBestValueRoute(validQuotes),
      recommendedRoute: optimizedRoutes[0]!, // <-- Add assertion here
    };
  }

  /**
   * Score a single route based on multiple factors
   */
  private scoreRoute(
    quote: BridgeQuote,
    allQuotes: BridgeQuote[],
    preferences: BridgePreferences
  ): OptimizedRoute {
    const breakdown = {
      outputScore: this.calculateOutputScore(quote, allQuotes),
      feeScore: this.calculateFeeScore(quote, allQuotes),
      speedScore: this.calculateSpeedScore(quote, allQuotes),
      reliabilityScore: this.calculateReliabilityScore(quote),
    };

    // Weight scores based on preferences
    const weights = this.getWeights(preferences);
    
    const score = 
      breakdown.outputScore * weights.output +
      breakdown.feeScore * weights.fee +
      breakdown.speedScore * weights.speed +
      breakdown.reliabilityScore * weights.reliability;

    const reasons = this.generateReasons(breakdown, preferences);

    return {
      quote,
      score,
      breakdown,
      reasons,
    };
  }

  /**
   * Calculate output amount score (0-100)
   */
  private calculateOutputScore(quote: BridgeQuote, allQuotes: BridgeQuote[]): number {
    if (allQuotes.length <= 1) return 100;
    
    const amounts = allQuotes.map(q => safeParseFloat(q.toAmount));
    const maxAmount = Math.max(...amounts);
    const minAmount = Math.min(...amounts);
    
    if (maxAmount === minAmount) return 100;
    
    const currentAmount = safeParseFloat(quote.toAmount);
    const score = ((currentAmount - minAmount) / (maxAmount - minAmount)) * 100;
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate fee score (0-100) - lower fees = higher score
   */
  private calculateFeeScore(quote: BridgeQuote, allQuotes: BridgeQuote[]): number {
    if (allQuotes.length <= 1) return 100;
    
    const fees = allQuotes.map(q => safeParseFloat(q.totalFee));
    const maxFee = Math.max(...fees);
    const minFee = Math.min(...fees);
    
    if (maxFee === minFee) return 100;
    
    const currentFee = safeParseFloat(quote.totalFee);
    const score = ((maxFee - currentFee) / (maxFee - minFee)) * 100;
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate speed score (0-100) - faster = higher score
   */
  private calculateSpeedScore(quote: BridgeQuote, allQuotes: BridgeQuote[]): number {
    if (allQuotes.length <= 1) return 100;
    
    const times = allQuotes.map(q => q.estimatedTime?.max || 60);
    const maxTime = Math.max(...times);
    const minTime = Math.min(...times);
    
    if (maxTime === minTime) return 100;
    
    const currentTime = quote.estimatedTime?.max || 60;
    const score = ((maxTime - currentTime) / (maxTime - minTime)) * 100;
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate reliability score based on bridge confidence
   */
  private calculateReliabilityScore(quote: BridgeQuote): number {
    return quote.confidence || 80;
  }

  /**
   * Get weights based on user preferences
   */
  private getWeights(preferences: BridgePreferences): {
    output: number;
    fee: number;
    speed: number;
    reliability: number;
  } {
    switch (preferences.priority) {
      case 'cost':
        return { output: 0.2, fee: 0.5, speed: 0.15, reliability: 0.15 };
      case 'speed':
        return { output: 0.2, fee: 0.15, speed: 0.5, reliability: 0.15 };
      case 'reliability':
        return { output: 0.2, fee: 0.15, speed: 0.15, reliability: 0.5 };
      case 'balanced':
      default:
        return { output: 0.3, fee: 0.25, speed: 0.25, reliability: 0.2 };
    }
  }

  /**
   * Filter quotes based on options
   */
  private filterQuotes(
    quotes: BridgeQuote[],
    options: RouteOptimizationOptions
  ): BridgeQuote[] {
    let filtered = [...quotes];

    // Filter by include list
    if (options.includeBridges && options.includeBridges.length > 0) {
      const includes = new Set(options.includeBridges);
      filtered = filtered.filter(q => includes.has(q.bridge));
    }

    // Filter by exclude list
    if (options.excludeBridges && options.excludeBridges.length > 0) {
      const excludes = new Set(options.excludeBridges);
      filtered = filtered.filter(q => !excludes.has(q.bridge));
    }

    // Filter by max acceptable slippage
    if (options.maxSlippage !== undefined) {
      filtered = filtered.filter(q => {
        const rate = safeParseFloat(q.rate);
        const expected = safeParseFloat(q.fromAmount);
        if (expected === 0 || rate === 0) return true;
        
        const output = safeParseFloat(q.toAmount);
        const slippage = Math.abs((output / expected - rate) / rate) * 100;
        return slippage <= options.maxSlippage!;
      });
    }

    // Filter by instant execution if preferred
    const prefs = options.preferences || DEFAULT_BRIDGE_PREFERENCES;
    if (prefs.instantOnly) {
      filtered = filtered.filter(q => q.instant);
    }

    return filtered;
  }

  private findFastestRoute(quotes: BridgeQuote[]): OptimizedRoute {
    const sorted = [...quotes].sort((a, b) => 
      (a.estimatedTime?.max || 60) - (b.estimatedTime?.max || 60)
    );
    
    // Add assertion here
    return this.createMockOptimizedRoute(sorted[0]!, ['Fastest execution time'], { speedScore: 100 });
  }

  /**
   * Find cheapest route
   */
  private findCheapestRoute(quotes: BridgeQuote[]): OptimizedRoute {
    const sorted = [...quotes].sort((a, b) => 
      safeParseFloat(a.totalFee) - safeParseFloat(b.totalFee)
    );
    
    // Add assertion here
    return this.createMockOptimizedRoute(sorted[0]!, ['Lowest fees'], { feeScore: 100 });
  }

  /**
   * Find best value route (best output for lowest fee)
   */
  private findBestValueRoute(quotes: BridgeQuote[]): OptimizedRoute {
    const withValue = quotes.map(q => {
      const output = safeParseFloat(q.toAmount);
      const fee = safeParseFloat(q.totalFee);
      // Clamp fee to a minimum > 0 to prevent division by zero / Infinity
      const clampedFee = Math.max(fee, 0.000001); 
      return { quote: q, value: output / clampedFee };
    });
    
    const sorted = withValue.sort((a, b) => b.value - a.value);
    
    // Add assertion here
    return this.createMockOptimizedRoute(sorted[0]!.quote, ['Best value for money'], { outputScore: 50, feeScore: 50 });
  }

  /**
   * Helper to build manual OptimizedRoutes for the comparators
   */
  private createMockOptimizedRoute(
    quote: BridgeQuote, 
    reasons: string[], 
    overrides: Partial<OptimizedRoute['breakdown']>
  ): OptimizedRoute {
    return {
      quote,
      score: 100,
      breakdown: {
        outputScore: 0,
        feeScore: 0,
        speedScore: 0,
        reliabilityScore: 0,
        ...overrides
      },
      reasons,
    };
  }

  /**
   * Generate human-readable reasons for the route score
   */
  private generateReasons(
    breakdown: { outputScore: number; feeScore: number; speedScore: number; reliabilityScore: number },
    preferences: BridgePreferences
  ): string[] {
    const reasons: string[] = [];

    if (breakdown.outputScore >= 80) reasons.push('Best output amount');
    if (breakdown.feeScore >= 80) reasons.push('Lowest fees');
    if (breakdown.speedScore >= 80) reasons.push('Fastest execution');
    if (breakdown.reliabilityScore >= 90) reasons.push('Highly reliable bridge');

    // Add preference-based context
    switch (preferences.priority) {
      case 'cost':
        if (!reasons.includes('Lowest fees')) reasons.push('Optimized for cost');
        break;
      case 'speed':
        if (!reasons.includes('Fastest execution')) reasons.push('Optimized for speed');
        break;
      case 'reliability':
        if (!reasons.includes('Highly reliable bridge')) reasons.push('Optimized for reliability');
        break;
      default:
        reasons.push('Balanced optimization');
    }

    return reasons;
  }

  /**
   * Get market insights for routes
   */
  getMarketInsights(quotes: BridgeQuote[]): {
    averageOutput: string;
    averageFee: string;
    averageTime: number;
    bestBridge: string;
  } {
    if (quotes.length === 0) {
      return {
        averageOutput: '0',
        averageFee: '0',
        averageTime: 0,
        bestBridge: 'N/A',
      };
    }

    const totalOutput = quotes.reduce((sum, q) => sum + safeParseFloat(q.toAmount), 0);
    const totalFee = quotes.reduce((sum, q) => sum + safeParseFloat(q.totalFee), 0);
    const totalTime = quotes.reduce((sum, q) => sum + (q.estimatedTime?.max || 0), 0);

    const bestBridge = [...quotes].sort((a, b) => 
      (b.confidence || 0) - (a.confidence || 0)
    )[0]?.bridge || 'N/A';

    return {
      averageOutput: (totalOutput / quotes.length).toFixed(4),
      averageFee: (totalFee / quotes.length).toFixed(6),
      averageTime: Math.round(totalTime / quotes.length),
      bestBridge,
    };
  }

  /**
   * Fallback empty state for RouteComparison gracefully.
   */
  private createFallbackRoute(seedQuote?: BridgeQuote): OptimizedRoute {
    return {
      quote: seedQuote || {
        bridge: 'none',
        displayName: 'No Routes Available',
        fromChain: '0',
        toChain: '0',
        fromToken: '',
        toToken: '',
        fromAmount: '0',
        toAmount: '0',
        rate: '0',
        gasEstimate: '0',
        gasFee: '0',
        bridgeFee: '0',
        totalFee: '0',
        estimatedTime: { min: 0, max: 0 },
        instant: false,
        confidence: 0,
      },
      score: 0,
      breakdown: { outputScore: 0, feeScore: 0, speedScore: 0, reliabilityScore: 0 },
      reasons: ['No viable routes found matching criteria'],
    };
  }
}

// Export singleton
export const routeOptimizer = new RouteOptimizer();

// Export convenience functions
export function optimizeRoutes(
  quotes: BridgeQuote[],
  options?: RouteOptimizationOptions
): OptimizedRoute[] {
  return routeOptimizer.optimizeRoutes(quotes, options);
}

export function compareRoutes(
  quotes: BridgeQuote[],
  options?: RouteOptimizationOptions
): RouteComparison {
  return routeOptimizer.compareRoutes(quotes, options);
}