import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from 'next-auth';
import { 
  getPriceAlerts, 
  getActivePriceAlerts,
  createPriceAlert, 
  updatePriceAlert, 
  deletePriceAlert,
  togglePriceAlert,
  getCachedPrice 
} from '@/lib/database';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Get user session for authentication
  const session = await getServerSession(req, res, authOptions);
  
  if (!session?.user?.email && !session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const userId = session.user.id || session.user.email;

  // GET - Fetch user's price alerts with current prices
  if (req.method === 'GET') {
    try {
      const { active } = req.query;
      
      const alerts = active === 'true' 
        ? await getActivePriceAlerts(userId)
        : await getPriceAlerts(userId);
      
      // Fetch current prices for each alert
      const alertsWithPrices = await Promise.all(
        alerts.map(async (alert) => {
          const priceData = await getCachedPrice(alert.coin, alert.network);
          return {
            ...alert,
            currentPrice: priceData?.usdPrice || null,
            lastUpdated: priceData?.updatedAt || null,
          };
        })
      );
      
      return res.status(200).json(alertsWithPrices);
    } catch (error) {
      console.error('Error fetching price alerts:', error);
      return res.status(500).json({ error: 'Failed to fetch price alerts' });
    }
  }

  // POST - Create new price alert
  if (req.method === 'POST') {
    try {
      const { coin, network, name, targetPrice, condition } = req.body;

      if (!coin || !network || !name || !targetPrice || !condition) {
        return res.status(400).json({ 
          error: 'Missing required fields: coin, network, name, targetPrice, condition' 
        });
      }

      if (condition !== 'gt' && condition !== 'lt') {
        return res.status(400).json({ 
          error: 'Invalid condition. Must be "gt" (greater than) or "lt" (less than)' 
        });
      }

      const result = await createPriceAlert(
        userId,
        coin,
        network,
        name,
        targetPrice.toString(),
        condition
      );
      
      if (!result) {
        return res.status(500).json({ error: 'Failed to create price alert' });
      }

      // Get current price for the alert
      const priceData = await getCachedPrice(coin, network);
      
      return res.status(201).json({
        ...result,
        currentPrice: priceData?.usdPrice || null,
      });
    } catch (error) {
      console.error('Error creating price alert:', error);
      return res.status(500).json({ error: 'Failed to create price alert' });
    }
  }

  // PUT - Update price alert
  if (req.method === 'PUT') {
    try {
      const { id, targetPrice, condition, isActive } = req.body;

      if (!id) {
        return res.status(400).json({ error: 'Missing required field: id' });
      }

      const updates: { targetPrice?: string; condition?: 'gt' | 'lt'; isActive?: boolean } = {};
      
      if (targetPrice !== undefined) {
        updates.targetPrice = targetPrice.toString();
      }
      
      if (condition !== undefined) {
        if (condition !== 'gt' && condition !== 'lt') {
          return res.status(400).json({ 
            error: 'Invalid condition. Must be "gt" or "lt"' 
          });
        }
        updates.condition = condition;
      }
      
      if (isActive !== undefined) {
        updates.isActive = isActive;
      }

      const result = await updatePriceAlert(Number(id), userId, updates);
      
      if (!result) {
        return res.status(404).json({ error: 'Price alert not found' });
      }

      return res.status(200).json(result);
    } catch (error) {
      console.error('Error updating price alert:', error);
      return res.status(500).json({ error: 'Failed to update price alert' });
    }
  }

  // DELETE - Delete price alert
  if (req.method === 'DELETE') {
    try {
      const { id } = req.body;

      if (!id) {
        return res.status(400).json({ error: 'Missing required field: id' });
      }

      const result = await deletePriceAlert(Number(id), userId);
      
      if (!result) {
        return res.status(404).json({ error: 'Price alert not found' });
      }

      return res.status(200).json({ success: true, message: 'Price alert deleted' });
    } catch (error) {
      console.error('Error deleting price alert:', error);
      return res.status(500).json({ error: 'Failed to delete price alert' });
    }
  }

  // PATCH - Toggle price alert active status
  if (req.method === 'PATCH') {
    try {
      const { id, isActive } = req.body;

      if (!id || isActive === undefined) {
        return res.status(400).json({ error: 'Missing required fields: id, isActive' });
      }

      const result = await togglePriceAlert(Number(id), userId, isActive);
      
      if (!result) {
        return res.status(404).json({ error: 'Price alert not found' });
      }

      return res.status(200).json(result);
    } catch (error) {
      console.error('Error toggling price alert:', error);
      return res.status(500).json({ error: 'Failed to toggle price alert' });
    }
  }

  // Method not allowed
  return res.status(405).json({ error: 'Method not allowed' });
}
