// API endpoint for gas price estimation
// GET /api/gas-estimate?chain=ethereum&network=mainnet
// POST /api/gas-estimate (for batch requests)

import { NextApiRequest, NextApiResponse } from 'next';
import { 
  getGasEstimate, 
  getMultiChainGasEstimates, 
  compareGasPrices,
  getOptimizationRecommendation,
  predictGasPrice,
  formatGasPrice,
  gasPriceToUsd
} from '../../../shared/services/gas-estimator';
import { getActiveGasTokens, getUserGasPreferences } from '../../../shared/services/gas-token-service';
import { csrfGuard } from '@/lib/csrf';

// Supported chains
const SUPPORTED_CHAINS = ['ethereum', 'polygon', 'bsc', 'arbitrum', 'optimism', 'base'];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // CSRF Protection for POST requests
  if (req.method === 'POST' && !csrfGuard(req, res)) {
    return;
  }

  try {
    switch (req.method) {
      case 'GET':
        return await handleGet(req, res);
      case 'POST':
        return await handlePost(req, res);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Gas estimate API error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// Handle GET requests - single chain or comparison
async function handleGet(req: NextApiRequest, res: NextApiResponse) {
  const { chain, network = 'mainnet', compare, userId, includeTokens } = req.query;
  
  // Validate chain
  if (chain && !SUPPORTED_CHAINS.includes(chain as string)) {
    return res.status(400).json({ 
      error: 'Unsupported chain',
      supportedChains: SUPPORTED_CHAINS
    });
  }

  // If compare parameter provided, compare two chains
  if (compare && chain) {
    const comparison = await compareGasPrices(chain as string, compare as string);
    return res.status(200).json({
      success: true,
      comparison: {
        fromChain: comparison.chain,
        toChain: compare,
        currentGas: {
          ...comparison.currentGas,
          formatted: formatGasPrice(comparison.currentGas.gasPrice),
        },
        recommendedGas: {
          ...comparison.recommendedGas,
          formatted: formatGasPrice(comparison.recommendedGas.gasPrice),
        },
        savings: comparison.savings,
        recommendation: comparison.recommendation,
        reason: comparison.reason,
      }
    });
  }

  // Single chain estimate
  if (chain) {
    const estimate = await getGasEstimate(chain as string, network as string);
    const prediction = await predictGasPrice(chain as string);
    
    // Get optimization recommendation if userId provided
    let optimization = null;
    if (userId) {
      const preferences = await getUserGasPreferences(userId as string);
      optimization = await getOptimizationRecommendation(
        chain as string,
        preferences.preferredGasToken || undefined,
        preferences.batchTransactions
      );
    }

    // Get available gas tokens for this chain
    let gasTokens = null;
    if (includeTokens === 'true') {
      gasTokens = await getActiveGasTokens(chain as string);
    }

    return res.status(200).json({
      success: true,
      estimate: {
        ...estimate,
        formatted: formatGasPrice(estimate.gasPrice),
      },
      prediction,
      optimization,
      gasTokens,
    });
  }

  // No chain specified - return all supported chains
  const estimates = await getMultiChainGasEstimates(SUPPORTED_CHAINS);
  
  return res.status(200).json({
    success: true,
    chains: estimates.map(e => ({
      ...e,
      formatted: formatGasPrice(e.gasPrice),
    })),
  });
}

// Handle POST requests - batch operations
async function handlePost(req: NextApiRequest, res: NextApiResponse) {
  const { chains, operation, userId, chain, gasLimit, nativePriceUsd } = req.body;

  // Batch chain estimates
  if (chains && Array.isArray(chains)) {
    const validChains = chains.filter(c => SUPPORTED_CHAINS.includes(c));
    const estimates = await getMultiChainGasEstimates(validChains);
    
    return res.status(200).json({
      success: true,
      chains: estimates.map(e => ({
        ...e,
        formatted: formatGasPrice(e.gasPrice),
      })),
    });
  }

  // Calculate USD cost
  if (operation === 'calculate-cost' && chain && gasLimit && nativePriceUsd) {
    const estimate = await getGasEstimate(chain);
    const usdCost = gasPriceToUsd(estimate.gasPrice, gasLimit, nativePriceUsd);
    
    return res.status(200).json({
      success: true,
      chain,
      gasPrice: estimate.gasPrice,
      gasLimit,
      nativePriceUsd,
      usdCost,
    });
  }

  // Get optimization recommendation
  if (operation === 'optimize' && chain) {
    const preferences = userId ? await getUserGasPreferences(userId) : null;
    const recommendation = await getOptimizationRecommendation(
      chain,
      preferences?.preferredGasToken || undefined,
      preferences?.batchTransactions || false
    );

    return res.status(200).json({
      success: true,
      recommendation: {
        ...recommendation,
        originalEstimate: {
          ...recommendation.originalEstimate,
          formatted: formatGasPrice(recommendation.originalEstimate.gasPrice),
        },
        optimizedEstimate: {
          ...recommendation.optimizedEstimate,
          formatted: formatGasPrice(recommendation.optimizedEstimate.gasPrice),
        },
      },
    });
  }

  return res.status(400).json({ 
    error: 'Invalid request',
    message: 'Please provide valid chains array or operation parameters'
  });
}
