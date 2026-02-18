import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

const BOT_SERVICE_URL = process.env.BOT_SERVICE_URL || 'http://localhost:3001';
const SIDESHIFT_CLIENT_IP = process.env.SIDESHIFT_CLIENT_IP || "127.0.0.1";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    fromAsset,
    toAsset,
    amount,
    fromChain,
    toChain,
    stakingProtocol,
    stakerAddress,
  } = req.body;

  // Validate required parameters
  if (!fromAsset || !toAsset || !amount || !stakingProtocol || !stakerAddress) {
    return res.status(400).json({
      error: 'Missing required parameters: fromAsset, toAsset, amount, stakingProtocol, stakerAddress',
    });
  }

  try {
    // Get user IP
    const forwarded = req.headers['x-forwarded-for'];
    let userIP = typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : req.socket.remoteAddress;

    if (userIP === '::1' || userIP === '127.0.0.1') {
      userIP = SIDESHIFT_CLIENT_IP;
    }

    if (!userIP) {
      return res.status(400).json({ error: 'Could not determine user IP address.' });
    }

    console.log(`Creating swap and stake order for user IP: ${userIP}`);

    // Call the bot service to create a swap and stake order
    const response = await axios.post(
      `${BOT_SERVICE_URL}/api/swap-and-stake/create`,
      {
        fromAsset,
        fromChain: fromChain || 'ethereum',
        toAsset,
        toChain: toChain || 'ethereum',
        amount: parseFloat(amount),
        stakingProtocol,
        stakerAddress,
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000,
      }
    );

    if (!response.data.success) {
      return res.status(400).json({
        error: response.data.error || 'Failed to create swap and stake order',
      });
    }

    return res.status(201).json({
      success: true,
      orderId: response.data.orderId || response.data.id,
      message: `Swap and Stake order created: ${amount} ${fromAsset} → ${toAsset} with ${stakingProtocol}`,
      data: response.data.data,
      estimatedApy: response.data.estimatedApy,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    console.error('API Route Error - Error creating swap and stake order:', errorMessage);
    return res.status(500).json({
      error: errorMessage,
    });
  }
}
