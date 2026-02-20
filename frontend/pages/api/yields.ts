import { NextApiRequest, NextApiResponse } from 'next';
import { getTopStablecoinYields, formatYieldPools } from '@/utils/yield-client';
import { csrfGuard } from '@/lib/csrf';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end();

  // CSRF Protection
  if (!csrfGuard(req, res)) {
    return;
  }

  const yields = await getTopStablecoinYields();

  // Return both raw data and formatted message for flexibility
  res.status(200).json({
    data: yields,
    message: formatYieldPools(yields)
  });
}
