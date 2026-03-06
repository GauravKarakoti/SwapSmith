import { NextApiRequest, NextApiResponse } from 'next';
import { getTopStablecoinYields, formatYieldPools, YieldPool } from '@/utils/yield-client';

export interface StakeQuote {
  fromAsset: string;
  amount: number;
  toAsset: string;
  estimatedApy: number;
  protocol: string;
  chain: string;
  depositAddress: string;
  steps: { step: number; action: string; description: string; status: string }[];
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { fromAsset, amount, stakeProtocol, chain } = req.body;

    // Validate required fields
    if (!fromAsset || !amount) {
      return res.status(400).json({ error: 'Missing required fields: fromAsset and amount' });
    }

    // Get yield pools for the asset
    const yields = await getTopStablecoinYields();
    
    // Filter yields by chain if specified
    let filteredYields = yields;
    if (chain) {
      filteredYields = yields.filter((p: YieldPool) => p.chain.toLowerCase() === chain.toLowerCase());
    }

    // If specific protocol requested, filter by that
    if (stakeProtocol) {
      filteredYields = filteredYields.filter((p: YieldPool) => 
        p.project.toLowerCase() === stakeProtocol.toLowerCase()
      );
    }

    // Get the best yield pool
    const bestPool = filteredYields.length > 0 ? filteredYields[0] : yields[0];

    if (!bestPool) {
      return res.status(404).json({ error: 'No yield pool found for the specified asset' });
    }

    // Create stake quote
    const stakeQuote: StakeQuote = {
      fromAsset: fromAsset.toUpperCase(),
      amount: parseFloat(amount),
      toAsset: bestPool.symbol,
      estimatedApy: bestPool.apy,
      protocol: bestPool.project,
      chain: bestPool.chain,
      depositAddress: bestPool.poolId || '',
      steps: [
        {
          step: 1,
          action: 'swap',
          description: `Swap ${amount} ${fromAsset.toUpperCase()} to ${bestPool.symbol}`,
          status: 'pending'
        },
        {
          step: 2,
          action: 'stake',
          description: `Deposit ${bestPool.symbol} to ${bestPool.project} for ${bestPool.apy.toFixed(2)}% APY`,
          status: 'ready'
        }
      ]
    };

    // Return the stake quote with formatted message
    const message = `⚡ *Stake Quote*\n\n` +
      `*From:* ${amount} ${fromAsset.toUpperCase()}\n` +
      `*To:* ${bestPool.symbol}\n` +
      `*Protocol:* ${bestPool.project}\n` +
      `*Chain:* ${bestPool.chain}\n` +
      `*APY:* *${bestPool.apy.toFixed(2)}%*\n\n` +
      `*Steps:*\n` +
      `1. 🔄 Swap ${fromAsset.toUpperCase()} → ${bestPool.symbol}\n` +
      `2. 📈 Deposit to ${bestPool.project}\n\n` +
      `Ready to proceed?`;

    res.status(200).json({
      success: true,
      data: stakeQuote,
      message
    });
  } catch (error) {
    console.error('Stake quote error:', error);
    res.status(500).json({ error: 'Failed to get stake quote' });
  }
}
