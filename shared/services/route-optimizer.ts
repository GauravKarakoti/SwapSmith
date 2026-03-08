/**
 * Route Optimizer Service
 * Optimizes cross-chain routes based on user preferences and market conditions
 */

import { BridgeQuote } from './bridges/base-bridge-adapter';
import { BridgePreferences, DEFAULT_BRIDGE_PREFERENCES, BRIDGE_CONFIGS } from '../config/bridge-config';

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
 * Route Optimizer Class
 * Analyzes and optimizes cross-chain routes
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
    let filteredQuotes = this.filterQuotes(quotes, options);
    
    // Score each route
    const scoredRoutes = filteredQuotes.map(quote => 
      this.scoreRoute(quote, quotes, prefs)
    );
    
    // Sort by score (descending)
    return scoredRoutes.sort((a, b) => b.score - a.score);
  }

  /**
   * Compare multiple routes and provide recommendations
   */
  compareRoutes(
    quotes: BridgeQuote[],
    options: RouteOptimizationOptions = {}
  ): RouteComparison {
    const optimizedRoutes = this.optimizeRoutes(quotes, options);
    
    if (optimizedRoutes.length === 0) {
      return {
        routes: [],
        fastestRoute: optimizedRoutes[0],
        cheapestRoute: optimizedRoutes[0],
        bestValueRoute: optimizedRoutes[0],
        recommendedRoute: optimizedRoutes[0],
      };
    }

    // Find fastest route
    const fastestRoute = this.findFastestRoute(quotes);
    
    // Find cheapest route
    const cheapestRoute = this.findCheapestRoute(quotes);
    
    // Find best value (output vs fee)
    const bestValueRoute = this.findBestValueRoute(quotes);
    
    // Recommended is the highest scored
    const recommendedRoute = optimizedRoutes[0];

    return {
      routes: optimizedRoutes,
      fastestRoute,
      cheapestRoute,
      bestValueRoute,
      recommendedRoute,
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
    if (allQuotes.length === 0) return 50;
    
    const amounts = allQuotes.map(q => Number(q.toAmount));
    const maxAmount = Math.max(...amounts);
    const minAmount = Math.min(...amounts);
    
    if (maxAmount === minAmount) return 50;
    
    const score = ((Number(quote.toAmount) - minAmount) / (maxAmount - minAmount)) * 100;
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate fee score (0-100) - lower fees = higher score
   */
  private calculateFeeScore(quote: BridgeQuote, allQuotes: BridgeQuote[]): number {
    if (allQuotes.length === 0) return 50;
    
    const fees = allQuotes.map(q => Number(q.totalFee || '0'));
    const maxFee = Math.max(...fees);
    const minFee = Math.min(...fees);
    
    if (maxFee === minFee) return 50;
    
    const currentFee = Number(quote.totalFee || '0');
    const score = ((maxFee - currentFee) / (maxFee - minFee)) * 100;
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate speed score (0-100) - faster = higher score
   */
  private calculateSpeedScore(quote: BridgeQuote, allQuotes: BridgeQuote[]): number {
    if (allQuotes.length === 0) return 50;
    
    const times = allQuotes.map(q => q.estimatedTime?.max || 60);
    const maxTime = Math.max(...times);
    const minTime = Math.min(...times);
    
    if (maxTime === minTime) return 50;
    
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
      filtered = filtered.filter(q => 
        options.includeBridges!.includes(q.bridge)
      );
    }

    // Filter by exclude list
    if (options.excludeBridges && options.excludeBridges.length > 0) {
      filtered = filtered.filter(q => 
        !options.excludeBridges!.includes(q.bridge)
      );
    }

    // Filter by slippage
    if (options.maxSlippage) {
      filtered = filtered.filter(q => {
        const rate = parseFloat(q.rate || '0');
        const expected = parseFloat(q.fromAmount);
        if (expected === 0) return true;
        const slippage = Math.abs((Number(q.toAmount) / expected - rate) / rate) * 100;
        return slippage <= options.maxSlippage!;
      });
    }

    // Filter by instant if preferred
    const prefs = options.preferences || DEFAULT_BRIDGE_PREFERENCES;
    if (prefs.instantOnly) {
      filtered = filtered.filter(q => q.instant);
    }

    return filtered;
  }

  /**
   * Find fastest route
   */
  private findFastestRoute(quotes: BridgeQuote[]): OptimizedRoute {
    const sorted = [...quotes].sort((a, b) => 
      (a.estimatedTime?.max || 60) - (b.estimatedTime?.max || 60)
    );
    
    return {
      quote: sorted[0],
      score: 100,
      breakdown: {
        outputScore: 0,
        feeScore: 0,
        speedScore: 100,
        reliabilityScore: 0,
      },
      reasons: ['Fastest execution time'],
    };
  }

  /**
   * Find cheapest route
   */
  private findCheapestRoute(quotes: BridgeQuote[]): OptimizedRoute {
    const sorted = [...quotes].sort((a, b) => 
      Number(a.totalFee || '0') - Number(b.totalFee || '0')
    );
    
    return {
      quote: sorted[0],
      score: 100,
      breakdown: {
        outputScore: 0,
        feeScore: 100,
        speedScore: 0,
        reliabilityScore: 0,
      },
      reasons: ['Lowest fees'],
    };
  }

  /**
   * Find best value route (best output for lowest fee)
   */
  private findBestValueRoute(quotes: BridgeQuote[]): OptimizedRoute {
    const withValue = quotes.map(q => {
      const output = Number(q.toAmount);
      const fee = Number(q.totalFee || '1');
      const value = output / fee;
      return { quote: q, value: isFinite(value) ? value : 0 };
    });
    
    const sorted = withValue.sort((a, b) => b.value - a.value);
    
    return {
      quote: sorted[0].quote,
      score: 100,
      breakdown: {
        outputScore: 50,
        feeScore: 50,
        speedScore: 0,
        reliabilityScore: 0,
      },
      reasons: ['Best value for money'],
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

    if (breakdown.outputScore >= 80) {
      reasons.push('Best output amount');
    }
    
    if (breakdown.feeScore >= 80) {
      reasons.push('Lowest fees');
    }
    
    if (breakdown.speedScore >= 80) {
      reasons.push('Fastest execution');
    }
    
    if (breakdown.reliabilityScore >= 90) {
      reasons.push('Most reliable bridge');
    }

    // Add preference-based reason
    switch (preferences.priority) {
      case 'cost':
        if (!reasons.includes('Lowest fees')) reasons.push('Optimized for cost');
        break;
      case 'speed':
        if (!reasons.includes('Fastest execution')) reasons.push('Optimized for speed');
        break;
      case 'reliability':
        if (!reasons.includes('Most reliable bridge')) reasons.push('Optimized for reliability');
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
    popularRoutes: Array<{ from: string; to: string; count: number }>;
  } {
    if (quotes.length === 0) {
      return {
        averageOutput: '0',
        averageFee: '0',
        averageTime: 0,
        bestBridge: 'N/A',
        popularRoutes: [],
      };
    }

    const totalOutput = quotes.reduce((sum, q) => sum + Number(q.toAmount), 0);
    const totalFee = quotes.reduce((sum, q) => sum + Number(q.totalFee || '0'), 0);
    const totalTime = quotes.reduce((sum, q) => sum + (q.estimatedTime?.max || 0), 0);

    // Find most reliable bridge
    const bestBridge = [...quotes].sort((a, b) => 
      (b.confidence || 0) - (a.confidence || 0)
    )[0]?.bridge || 'N/A';

    return {
      averageOutput: (totalOutput / quotes.length).toFixed(2),
      averageFee: (totalFee / quotes.length).toFixed(6),
      averageTime: Math.round(totalTime / quotes.length),
      bestBridge,
      popularRoutes: [],
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
