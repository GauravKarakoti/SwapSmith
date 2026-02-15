import { NextApiRequest, NextApiResponse } from 'next';
import { createCheckout } from '@/utils/sideshift-client';

const SIDESHIFT_CLIENT_IP = process.env.SIDESHIFT_CLIENT_IP || "127.0.0.1";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  
  // ✅ Added settleAddress to destructuring
  const { settleAsset, settleNetwork, settleAmount, settleAddress } = req.body;
  
  if (!settleAddress) {
    return res.status(400).json({ error: 'Settle address is required' });
  }

  try {
    const forwarded = req.headers['x-forwarded-for'];
    let userIP = (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : undefined) || req.socket.remoteAddress ||undefined;
    if (!userIP || userIP === '::1' || userIP === '127.0.0.1') { userIP = SIDESHIFT_CLIENT_IP;}

    // ✅ Pass settleAddress to the function
    const result = await createCheckout(settleAsset, settleNetwork, settleAmount, settleAddress, userIP);
    res.status(200).json(result);
  } catch (error: unknown) {
    const err = error as Error;
    res.status(500).json({ error: err.message });
  }
}