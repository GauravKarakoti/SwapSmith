import { NextApiRequest, NextApiResponse } from 'next';
import { createQuote } from '@/utils/sideshift-client';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  console.log("Request body:", req.body);

  const { fromAsset, toAsset, amount, fromChain, toChain } = req.body;

  if (!fromAsset || !toAsset || !amount) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  try {
    const quote = await createQuote(fromAsset, fromChain, toAsset, toChain, amount);
    res.status(200).json(quote);
  } catch (error: any) {
    console.error('Error creating quote:', error);
    res.status(500).json({ error: error.message });
  }
}