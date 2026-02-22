import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from 'next-auth';
import { getWatchlist, addToWatchlist, removeFromWatchlist } from '@/lib/database';
import { getCachedPrice } from '@/lib/database';
import logger from '@/lib/logger';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Get user session for authentication
  const session = await getServerSession(req, res, authOptions);
  
  if (!session?.user?.email && !session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const userId = session.user.id || session.user.email;

  // GET - Fetch user's watchlist with current prices
  if (req.method === 'GET') {
    try {
      const watchlist = await getWatchlist(userId);
      
      // Fetch current prices for each watched token
      const watchlistWithPrices = await Promise.all(
        watchlist.map(async (item) => {
          const priceData = await getCachedPrice(item.coin, item.network);
          return {
            ...item,
            usdPrice: priceData?.usdPrice || null,
            btcPrice: priceData?.btcPrice || null,
            lastUpdated: priceData?.updatedAt || null,
          };
        })
      );
      
      return res.status(200).json(watchlistWithPrices);
    } catch (error) {
      logger.error('Error fetching watchlist:', { error });
      return res.status(500).json({ error: 'Failed to fetch watchlist' });
    }
  }

  // POST - Add token to watchlist
  if (req.method === 'POST') {
    try {
      const { coin, network, name } = req.body;

      if (!coin || !network || !name) {
        return res.status(400).json({ error: 'Missing required fields: coin, network, name' });
      }

      const result = await addToWatchlist(userId, coin, network, name);
      
      if (!result) {
        return res.status(500).json({ error: 'Failed to add to watchlist' });
      }

      // Get current price for the added token
      const priceData = await getCachedPrice(coin, network);
      
      return res.status(201).json({
        ...result,
        usdPrice: priceData?.usdPrice || null,
        btcPrice: priceData?.btcPrice || null,
      });
    } catch (error) {
      logger.error('Error adding to watchlist:', { error });
      return res.status(500).json({ error: 'Failed to add to watchlist' });
    }
  }

  // DELETE - Remove token from watchlist
  if (req.method === 'DELETE') {
    try {
      const { coin, network } = req.body;

      if (!coin || !network) {
        return res.status(400).json({ error: 'Missing required fields: coin, network' });
      }

      const result = await removeFromWatchlist(userId, coin, network);
      
      if (!result) {
        return res.status(500).json({ error: 'Failed to remove from watchlist' });
      }

      return res.status(200).json({ success: true, message: 'Token removed from watchlist' });
    } catch (error) {
      logger.error('Error removing from watchlist:', { error });
      return res.status(500).json({ error: 'Failed to remove from watchlist' });
    }
  }

  // Method not allowed
  return res.status(405).json({ error: 'Method not allowed' });
}
