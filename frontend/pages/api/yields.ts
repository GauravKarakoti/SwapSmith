import { NextApiRequest, NextApiResponse } from 'next';
import { getTopStablecoinYields } from '@/utils/yield-client';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end();
  const yields = await getTopStablecoinYields();
  res.status(200).json({ message: yields });
}