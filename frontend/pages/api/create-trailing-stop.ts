import { NextApiRequest, NextApiResponse } from 'next';
import { csrfGuard } from '@/lib/csrf';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // CSRF Protection
  if (!csrfGuard(req, res)) {
    return;
  }

  const {
    fromAsset,
    fromNetwork,
    toAsset,
    toNetwork,
    fromAmount,
    trailingPercentage,
    settleAddress,
    userId,
    expiresAt,
  } = req.body;

  // Validate required parameters
  if (
    !fromAsset ||
    !toAsset ||
    !fromAmount ||
    trailingPercentage === undefined ||
    !settleAddress
  ) {
    return res.status(400).json({
      error: 'Missing required parameters: fromAsset, toAsset, fromAmount, trailingPercentage, settleAddress',
    });
  }

  if (trailingPercentage <= 0 || trailingPercentage > 100) {
    return res.status(400).json({
      error: 'Invalid trailingPercentage. Must be between 0 and 100',
    });
  }

  try {
    // Call the backend bot service to create a trailing stop order
    const response = await fetch(
      `${process.env.BOT_SERVICE_URL || 'http://localhost:3001'}/api/trailing-stop/create`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromAsset,
          fromNetwork: fromNetwork || 'ethereum',
          toAsset,
          toNetwork: toNetwork || 'ethereum',
          fromAmount: parseFloat(fromAmount),
          trailingPercentage: parseFloat(trailingPercentage),
          settleAddress,
          userId,
          expiresAt,
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      return res.status(response.status).json({
        error: errorData.error || 'Failed to create trailing stop order',
      });
    }

    const result = await response.json();

    return res.status(201).json({
      success: true,
      trailingStopId: result.id,
      message: `Trailing stop order created: Sell ${fromAmount} ${fromAsset} if price drops ${trailingPercentage}% from peak`,
      data: result,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    console.error('API Route Error - Error creating trailing stop order:', errorMessage);
    return res.status(500).json({
      error: errorMessage,
    });
  }
}
