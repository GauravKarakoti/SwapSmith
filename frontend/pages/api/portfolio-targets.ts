import { NextApiRequest, NextApiResponse } from 'next';
import { adminAuth } from '@/lib/firebase-admin';
import {
  getPortfolioTargets,
  getPortfolioTargetById,
  createPortfolioTarget,
  updatePortfolioTarget,
  deletePortfolioTarget,
  getRebalanceHistory,
} from '@/lib/database';
import logger from '@/lib/logger';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // 🔐 Firebase authentication
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  const idToken = authHeader.split('Bearer ')[1];

  let decodedToken;
  try {
    decodedToken = await adminAuth.verifyIdToken(idToken);
  } catch (error) {
    logger.error('Error verifying Firebase token', { error });
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }

  const userId = decodedToken.uid;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized: No user ID in token' });
  }

  // 📥 GET — Fetch user's portfolio targets
  if (req.method === 'GET') {
    try {
      const { id } = req.query;

      if (id) {
        // Get single portfolio target
        const target = await getPortfolioTargetById(parseInt(id as string), userId);
        if (!target) {
          return res.status(404).json({ error: 'Portfolio target not found' });
        }
        
        // Also get rebalance history for this target
        const history = await getRebalanceHistory(parseInt(id as string));
        
        return res.status(200).json({ ...target, history });
      }

      // Get all portfolio targets
      const targets = await getPortfolioTargets(userId);
      return res.status(200).json(targets);
    } catch (error) {
      logger.error('Error fetching portfolio targets', { error });
      return res.status(500).json({ error: 'Failed to fetch portfolio targets' });
    }
  }

  // ➕ POST — Create new portfolio target
  if (req.method === 'POST') {
    try {
      const { name, assets, driftThreshold, autoRebalance } = req.body;

      if (!name || !assets || !Array.isArray(assets) || assets.length === 0) {
        return res.status(400).json({
          error: 'Missing required fields: name and assets array',
        });
      }

      // Validate assets have required fields
      for (const asset of assets) {
        if (!asset.coin || !asset.network || !asset.targetPercentage) {
          return res.status(400).json({
            error: 'Each asset must have coin, network, and targetPercentage',
          });
        }
      }

      // Validate percentages sum to 100
      const totalPercentage = assets.reduce((sum: number, a: { targetPercentage: number }) => sum + a.targetPercentage, 0);
      if (Math.abs(totalPercentage - 100) > 0.1) {
        return res.status(400).json({
          error: `Asset percentages must sum to 100% (Current: ${totalPercentage}%)`,
        });
      }

      const result = await createPortfolioTarget(
        userId,
        name,
        assets,
        driftThreshold || 5.0,
        autoRebalance || false
      );

      return res.status(201).json(result);
    } catch (error) {
      logger.error('Error creating portfolio target', { error });
      return res.status(500).json({ error: 'Failed to create portfolio target' });
    }
  }

  // ✏️ PUT — Update portfolio target
  if (req.method === 'PUT') {
    try {
      const { id, name, assets, driftThreshold, autoRebalance, isActive } = req.body;

      if (!id) {
        return res.status(400).json({ error: 'Missing required field: id' });
      }

      const updateData: Record<string, unknown> = {};
      if (name) updateData.name = name;
      if (assets) {
        // Validate assets
        for (const asset of assets) {
          if (!asset.coin || !asset.network || !asset.targetPercentage) {
            return res.status(400).json({
              error: 'Each asset must have coin, network, and targetPercentage',
            });
          }
        }
        
        const totalPercentage = assets.reduce((sum: number, a: { targetPercentage: number }) => sum + a.targetPercentage, 0);
        if (Math.abs(totalPercentage - 100) > 0.1) {
          return res.status(400).json({
            error: `Asset percentages must sum to 100% (Current: ${totalPercentage}%)`,
          });
        }
        
        updateData.assets = assets;
      }
      if (driftThreshold !== undefined) updateData.driftThreshold = driftThreshold;
      if (autoRebalance !== undefined) updateData.autoRebalance = autoRebalance;
      if (isActive !== undefined) updateData.isActive = isActive;

      const result = await updatePortfolioTarget(id, userId, updateData);

      if (!result) {
        return res.status(404).json({ error: 'Portfolio target not found' });
      }

      return res.status(200).json(result);
    } catch (error) {
      logger.error('Error updating portfolio target', { error });
      return res.status(500).json({ error: 'Failed to update portfolio target' });
    }
  }

  // ❌ DELETE — Delete portfolio target
  if (req.method === 'DELETE') {
    try {
      const { id } = req.body;

      if (!id) {
        return res.status(400).json({ error: 'Missing required field: id' });
      }

      const result = await deletePortfolioTarget(id, userId);

      if (!result) {
        return res.status(404).json({ error: 'Portfolio target not found' });
      }

      return res.status(200).json({ success: true, message: 'Portfolio target deleted' });
    } catch (error) {
      logger.error('Error deleting portfolio target', { error });
      return res.status(500).json({ error: 'Failed to delete portfolio target' });
    }
  }

  // 🚫 Method not allowed
  return res.status(405).json({ error: 'Method not allowed' });
}
