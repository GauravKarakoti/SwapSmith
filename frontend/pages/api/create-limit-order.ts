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
    conditionOperator,
    conditionValue,
    conditionAsset,
    settleAddress,
    userId,
    walletAddress,
  } = req.body;


  // Validate required parameters
  if (
    !fromAsset ||
    !toAsset ||
    !amount ||
    !conditionOperator ||
    conditionValue === undefined ||
    !conditionAsset
  ) {
    return res.status(400).json({
      error: 'Missing required parameters: fromAsset, toAsset, amount, conditionOperator, conditionValue, conditionAsset',
    });
  }

  if (!['gt', 'lt'].includes(conditionOperator)) {
    return res.status(400).json({
      error: 'Invalid conditionOperator. Must be one of: gt (greater than), lt (less than)',
    });
  }

  try {
    // Call the backend bot service to create a limit order
    const response = await fetch(
      `${process.env.BOT_SERVICE_URL || 'http://localhost:3001'}/api/limit-order/create`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromAsset,
          fromChain: fromChain || 'ethereum',
          toAsset,
          toChain: toChain || 'ethereum',
          amount: parseFloat(amount),
          conditionOperator,
          conditionValue: parseFloat(conditionValue),
          conditionAsset,
          settleAddress,
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      return res.status(response.status).json({
        error: errorData.error || 'Failed to create limit order',
      });
    }

    const result = await response.json();

    // Create swap history entry for reputation tracking (limit orders are tracked as scheduled swaps)
    if (userId && result.id) {
      try {
        await createSwapHistoryEntry(userId, walletAddress, {
          sideshiftOrderId: `limit-${result.id}`,
          quoteId: result.quoteId || null,
          fromAsset,
          fromNetwork: fromChain || fromAsset,
          fromAmount: parseFloat(amount),
          toAsset,
          toNetwork: toChain || toAsset,
          settleAmount: '0', // Will be updated when limit order executes
          depositAddress: settleAddress,
          status: 'pending',
        });
        console.log(`[Reputation] Limit order swap history entry created for order ${result.id}`);
      } catch (historyError) {
        console.error('[Reputation] Failed to create limit order swap history entry:', historyError);
        // Don't fail the limit order creation if history creation fails
      }
    }

    const operatorText = conditionOperator === 'gt' ? 'above' : 'below';
    return res.status(201).json({
      success: true,
      limitOrderId: result.id,
      message: `Limit order created: Swap ${amount} ${fromAsset} to ${toAsset} when ${conditionAsset} is ${operatorText} $${conditionValue}`,
      data: result,
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    console.error('API Route Error - Error creating limit order:', errorMessage);
    return res.status(500).json({
      error: errorMessage,
    });
  }
}
