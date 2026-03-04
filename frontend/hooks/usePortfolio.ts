/**
 * Custom hooks for Portfolio Rebalancing
 * Separates data fetching and business logic from UI components
 */

import { useState, useCallback } from 'react';

export interface PortfolioAsset {
  coin: string;
  network: string;
  targetPercentage: number;
}

export interface PortfolioTarget {
  id: number;
  userId: string;
  name: string;
  assets: PortfolioAsset[];
  driftThreshold: number;
  isActive: boolean;
  autoRebalance: boolean;
  lastRebalancedAt: string | null;
  createdAt: string;
}

export interface RebalanceHistory {
  id: number;
  portfolioTargetId: number;
  triggerType: 'manual' | 'auto' | 'threshold';
  totalPortfolioValue: string;
  swapsExecuted: Record<string, unknown>[];
  totalFees: string;
  status: 'pending' | 'completed' | 'failed' | 'partial';
  errorMessage: string | null;
  startedAt: string;
  completedAt: string | null;
}

/**
 * Hook for fetching and managing portfolio targets
 */
export function usePortfolios() {
  const [portfolios, setPortfolios] = useState<PortfolioTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPortfolios = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/portfolio-targets');
      if (!response.ok) throw new Error('Failed to fetch portfolios');
      const data = await response.json();
      setPortfolios(data);
      setError(null);
    } catch (err) {
      setError('Failed to load portfolios');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  return { portfolios, loading, error, setError, fetchPortfolios, setPortfolios };
}

/**
 * Hook for portfolio CRUD operations
 */
export function usePortfolioActions() {
  const [submitting, setSubmitting] = useState(false);

  const createPortfolio = useCallback(
    async (
      name: string,
      assets: PortfolioAsset[],
      driftThreshold: number,
      autoRebalance: boolean
    ) => {
      try {
        setSubmitting(true);
        const response = await fetch('/api/portfolio-targets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, assets, driftThreshold, autoRebalance }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to create portfolio');
        }

        return await response.json();
      } finally {
        setSubmitting(false);
      }
    },
    []
  );

  const deletePortfolio = useCallback(async (id: number) => {
    try {
      const response = await fetch('/api/portfolio-targets', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });

      if (!response.ok) throw new Error('Failed to delete portfolio');
      return true;
    } catch (err) {
      console.error('Failed to delete portfolio:', err);
      return false;
    }
  }, []);

  const togglePortfolio = useCallback(async (id: number, isActive: boolean) => {
    try {
      const response = await fetch('/api/portfolio-targets', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, isActive }),
      });

      if (!response.ok) throw new Error('Failed to update portfolio');
      return await response.json();
    } catch (err) {
      console.error('Failed to update portfolio:', err);
      throw err;
    }
  }, []);

  return { createPortfolio, deletePortfolio, togglePortfolio, submitting };
}

/**
 * Hook for fetching portfolio history
 */
export function usePortfolioHistory() {
  const [history, setHistory] = useState<RebalanceHistory[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchHistory = useCallback(async (portfolioId: number) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/portfolio-targets?id=${portfolioId}`);
      if (!response.ok) throw new Error('Failed to fetch history');
      const data = await response.json();
      setHistory(data.history || []);
    } catch (err) {
      console.error('Failed to fetch history:', err);
      setHistory([]);
    } finally {
      setLoading(false);
    }
  }, []);

  return { history, loading, fetchHistory };
}
