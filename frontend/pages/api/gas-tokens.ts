// API endpoint for gas token management
// GET /api/gas-tokens - Get all active gas tokens
// GET /api/gas-tokens?chain=ethereum - Get tokens for specific chain
// GET /api/gas-tokens?userId=xxx - Get user preferences and recommended tokens
// POST /api/gas-tokens - Update user preferences

import { NextApiRequest, NextApiResponse } from 'next';
import { 
  getActiveGasTokens, 
  getGasToken,
  getUserGasPreferences,
  updateUserGasPreferences,
  getBestGasToken,
  shouldUseGasToken,
  calculateTokenSavings
} from '../../../shared/services/gas-token-service';
import { csrfGuard } from '@/lib/csrf';

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
    console.error('Gas tokens API error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// Handle GET requests
async function handleGet(req: NextApiRequest, res: NextApiResponse) {
  const { chain, userId, symbol, checkOptimization, estimatedGas } = req.query;

  // Get specific token by symbol
  if (symbol) {
    const token = await getGasToken(symbol as string);
    if (!token) {
      return res.status(404).json({ error: 'Gas token not found' });
    }
    return res.status(200).json({ success: true, token });
  }

  // Check if user should use gas token
  if (checkOptimization === 'true' && userId && chain && estimatedGas) {
    const recommendation = await shouldUseGasToken(
      userId as string,
      chain as string,
      parseFloat(estimatedGas as string)
    );
    
    return res.status(200).json({
      success: true,
      recommendation: {
        shouldUse: recommendation.shouldUse,
        token: recommendation.token,
        savings: {
          ...recommendation.savings,
          formatted: `${recommendation.savings.percent.toFixed(1)}%`,
        },
      },
    });
  }

  // Get user preferences and best token
  if (userId) {
    const [preferences, bestToken, allTokens] = await Promise.all([
      getUserGasPreferences(userId as string),
      chain ? getBestGasToken(chain as string, userId as string) : Promise.resolve(null),
      chain ? getActiveGasTokens(chain as string) : getActiveGasTokens(),
    ]);

    return res.status(200).json({
      success: true,
      preferences,
      recommendedToken: bestToken,
      availableTokens: allTokens,
    });
  }

  // Get all active tokens (optionally filtered by chain)
  const tokens = await getActiveGasTokens(chain as string | undefined);
  
  return res.status(200).json({
    success: true,
    tokens,
    count: tokens.length,
  });
}

// Handle POST requests - update user preferences
async function handlePost(req: NextApiRequest, res: NextApiResponse) {
  const { userId, preferences, operation } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  // Calculate savings for a specific token
  if (operation === 'calculate-savings' && req.body.tokenSymbol && req.body.gasAmount) {
    const savings = calculateTokenSavings(
      parseFloat(req.body.gasAmount),
      req.body.tokenSymbol
    );
    
    return res.status(200).json({
      success: true,
      tokenSymbol: req.body.tokenSymbol,
      gasAmount: req.body.gasAmount,
      savings: {
        ...savings,
        formatted: `${savings.percent.toFixed(1)}%`,
      },
    });
  }

  // Update user preferences
  if (preferences) {
    const updated = await updateUserGasPreferences(userId, preferences);
    
    return res.status(200).json({
      success: true,
      preferences: updated,
      message: 'Preferences updated successfully',
    });
  }

  return res.status(400).json({ 
    error: 'Invalid request',
    message: 'Please provide preferences or operation parameters'
  });
}
