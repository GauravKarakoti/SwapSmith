/**
 * Bridge Quote API Endpoint
 * Returns aggregated quotes from multiple bridge protocols
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { getAggregatedQuotes, getSingleBridgeQuote } from '../../../shared/services/bridge-aggregator';
import { optimizeRoutes, compareRoutes, OptimizedRoute, RouteComparison } from '../../../shared/services/route-optimizer';
import { DEFAULT_BRIDGE_PREFERENCES, BridgePreferences } from '../../../shared/config/bridge-config';
import { BridgeQuote } from '../../../shared/services/bridges/base-bridge-adapter';
import { csrfGuard } from '@/lib/csrf';
import logger from '@/lib/logger';

export interface BridgeQuoteRequest {
  fromChain: string;
  toChain: string;
  fromToken: string;
  toToken: string;
  amount: string;
  userAddress?: string;
  slippage?: number;
}

export interface BridgeQuoteResponse {
  success: boolean;
  data?: {
    quotes: BridgeQuote[];
    bestQuote: BridgeQuote | null;
    recommendedQuote: BridgeQuote | null;
    optimizedRoutes?: OptimizedRoute[];
    comparison?: RouteComparison;
    availableBridges: string[];
    errors?: Record<string, unknown>;
  };
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<BridgeQuoteResponse>
) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed. Use POST.',
    });
  }

  // CSRF Protection for form submissions
  if (!csrfGuard(req, res)) {
    return;
  }

  try {
    const {
      fromChain,
      toChain,
      fromToken,
      toToken,
      amount,
      userAddress,
      slippage = 0.5,
      bridge, // Optional: specific bridge to query
      preferences,
      optimize = true,
      compare = false,
    } = req.body as BridgeQuoteRequest & {
      bridge?: string;
      preferences?: BridgePreferences;
      optimize?: boolean;
      compare?: boolean;
    };

    // Validate required fields
    if (!fromChain || !toChain || !fromToken || !toToken || !amount) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: fromChain, toChain, fromToken, toToken, amount',
      });
    }

    // Validate amount is a positive number
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid amount. Must be a positive number.',
      });
    }

    // Merge user preferences with defaults
    const mergedPreferences: BridgePreferences = {
      ...DEFAULT_BRIDGE_PREFERENCES,
      ...preferences,
      maxSlippage: preferences?.maxSlippage ?? DEFAULT_BRIDGE_PREFERENCES.maxSlippage,
    };

    let result;

    // If specific bridge requested, get single quote
    if (bridge) {
      logger.info(`Fetching single bridge quote for ${bridge}`);
      
      const quote = await getSingleBridgeQuote(bridge, {
        fromChain,
        toChain,
        fromToken,
        toToken,
        amount,
        userAddress,
        slippage,
      });

      result = {
        quotes: [quote],
        bestQuote: quote,
        recommendedQuote: quote,
        availableBridges: [bridge],
      };
    } else {
      // Get aggregated quotes from all bridges
      logger.info(`Fetching aggregated bridge quotes for ${fromChain} -> ${toChain}`);
      
      const aggregated = await getAggregatedQuotes({
        fromChain,
        toChain,
        fromToken,
        toToken,
        amount,
        userAddress,
        slippage,
        preferences: mergedPreferences,
      });

      // Apply route optimization if requested
      let optimizedRoutes;
      let comparison;
      
      if (optimize && aggregated.quotes.length > 0) {
        optimizedRoutes = optimizeRoutes(aggregated.quotes, {
          preferences: mergedPreferences,
          maxSlippage: mergedPreferences.maxSlippage,
        });
      }

      if (compare && aggregated.quotes.length > 0) {
        comparison = compareRoutes(aggregated.quotes, {
          preferences: mergedPreferences,
          maxSlippage: mergedPreferences.maxSlippage,
        });
      }

      result = {
        quotes: aggregated.quotes,
        bestQuote: aggregated.bestQuote,
        recommendedQuote: aggregated.recommendedQuote,
        optimizedRoutes,
        comparison,
        availableBridges: aggregated.availableBridges,
        errors: Object.fromEntries(aggregated.errors),
      };
    }

    logger.info(`Bridge quote request successful: ${result.quotes?.length || 0} quotes found`);

    return res.status(200).json({
      success: true,
      data: result,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    logger.error('Bridge quote API error:', { error: errorMessage });

    return res.status(500).json({
      success: false,
      error: errorMessage,
    });
  }
}
