import { NextApiRequest, NextApiResponse } from 'next';
import { calculateReputationMetrics, calculateReputationMetricsByWallet, ReputationMetrics } from '@/lib/database';

interface ReputationResponse {
  success: boolean;
  data?: ReputationMetrics;
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ReputationResponse>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ 
      success: false,
      error: 'Method not allowed' 
    });
  }

  try {
    const { userId, walletAddress } = req.query;

    if (!userId && !walletAddress) {
      return res.status(400).json({
        success: false,
        error: 'Either userId or walletAddress is required',
      });
    }

    let metrics: ReputationMetrics;

    if (userId && typeof userId === 'string') {
      // Calculate metrics by user ID
      metrics = await calculateReputationMetrics(userId);
    } else if (walletAddress && typeof walletAddress === 'string') {
      // Calculate metrics by wallet address
      metrics = await calculateReputationMetricsByWallet(walletAddress);
    } else {
      return res.status(400).json({
        success: false,
        error: 'Invalid userId or walletAddress',
      });
    }

    // Set cache headers for reputation data (cache for 5 minutes)
    res.setHeader('Cache-Control', 'public, max-age=300');

    return res.status(200).json({
      success: true,
      data: metrics,
    });
  } catch (error) {
    console.error('Error fetching reputation metrics:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch reputation metrics',
    });
  }
}
