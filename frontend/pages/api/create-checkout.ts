import { NextApiRequest, NextApiResponse } from 'next';
import { createCheckout } from '@/utils/sideshift-client';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  
  // ✅ Added settleAddress to destructuring
  const { settleAsset, settleNetwork, settleAmount, settleAddress } = req.body;
  
  if (!settleAddress) {
    return res.status(400).json({ error: 'Settle address is required' });
  }

  try {
    const forwarded = req.headers['x-forwarded-for'];
    let userIP = typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : req.socket.remoteAddress || '1.1.1.1';
    if (userIP === '::1' || userIP === '127.0.0.1') userIP = '1.1.1.1';

    // ✅ Pass settleAddress to the function
    const result = await createCheckout(settleAsset, settleNetwork, settleAmount, settleAddress, userIP);
    res.status(200).json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}