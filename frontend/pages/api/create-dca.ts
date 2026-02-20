import { NextApiRequest, NextApiResponse } from 'next';
import { createSwapHistoryEntry } from '@/lib/database';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    fromAsset,
    fromChain,
    toAsset,
    toChain,
    amount,
    frequency,
    dayOfWeek,
    dayOfMonth,
    settleAddress,
    userId,
    walletAddress,
  } = req.body;


  // Validate required parameters
  if (!fromAsset || !toAsset || !amount || !frequency || !settleAddress) {
    return res.status(400).json({
      error: 'Missing required parameters: fromAsset, fromChain, toAsset, toChain, amount, frequency, settleAddress',
    });
  }

  if (!['daily', 'weekly', 'monthly'].includes(frequency)) {
    return res.status(400).json({
      error: 'Invalid frequency. Must be one of: daily, weekly, monthly',
    });
  }

  if (frequency === 'weekly' && !dayOfWeek) {
    return res.status(400).json({
      error: 'dayOfWeek is required for weekly DCA',
    });
  }

  if (frequency === 'monthly' && !dayOfMonth) {
    return res.status(400).json({
      error: 'dayOfMonth is required for monthly DCA',
    });
  }

  try {
    // Call the backend bot service to create a DCA schedule
    const response = await fetch(`${process.env.BOT_SERVICE_URL || 'http://localhost:3001'}/api/dca/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fromAsset,
        fromChain: fromChain || 'ethereum',
        toAsset,
        toChain: toChain || 'ethereum',
        amount: parseFloat(amount),
        frequency,
        dayOfWeek,
        dayOfMonth,
        settleAddress,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return res.status(response.status).json({
        error: errorData.error || 'Failed to create DCA schedule',
      });
    }

    const result = await response.json();

    // Create swap history entry for reputation tracking (DCA orders are tracked as scheduled swaps)
    if (userId && result.id) {
      try {
        await createSwapHistoryEntry(userId, walletAddress, {
          sideshiftOrderId: `dca-${result.id}`,
          quoteId: result.quoteId || null,
          fromAsset,
          fromNetwork: fromChain || fromAsset,
          fromAmount: parseFloat(amount),
          toAsset,
          toNetwork: toChain || toAsset,
          settleAmount: '0', // Will be updated when DCA executes
          depositAddress: settleAddress,
          status: 'pending',
        });
        console.log(`[Reputation] DCA swap history entry created for schedule ${result.id}`);
      } catch (historyError) {
        console.error('[Reputation] Failed to create DCA swap history entry:', historyError);
        // Don't fail the DCA creation if history creation fails
      }
    }

    return res.status(201).json({
      success: true,
      dcaId: result.id,
      message: `DCA schedule created: ${amount} ${fromAsset} → ${toAsset} every ${frequency}`,
      data: result,
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    console.error('API Route Error - Error creating DCA:', errorMessage);
    return res.status(500).json({
      error: errorMessage,
    });
  }
}
