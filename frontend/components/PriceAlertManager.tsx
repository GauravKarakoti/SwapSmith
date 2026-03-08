'use client';

import { useState, useEffect } from 'react';
import { Bell, Trash2, Plus, X, Loader2, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface PriceAlert {
  id: number;
  userId: string;
  coin: string;
  network: string;
  name: string;
  targetPrice: string;
  condition: 'gt' | 'lt';
  isActive: boolean;
  triggeredAt: Date | string | null;
  createdAt: Date | string;
  currentPrice?: string | null;
}

interface PriceAlertManagerProps {
  onSwap?: (coin: string, network: string) => void;
}

export default function PriceAlertManager({ onSwap: _onSwap }: PriceAlertManagerProps) {
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Fetch alerts on mount
  useEffect(() => {
    fetchAlerts();
  }, []);

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/price-alerts');
      if (!response.ok) throw new Error('Failed to fetch alerts');
      const data = await response.json();
      setAlerts(data);
      setError(null);
    } catch (err) {
      setError('Failed to load price alerts');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const createAlert = async (
    coin: string,
    network: string,
    name: string,
    targetPrice: number,
    condition: 'gt' | 'lt'
  ) => {
    try {
      setSubmitting(true);
      const response = await fetch('/api/price-alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coin,
          network,
          name,
          targetPrice: targetPrice.toString(),
          condition,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create alert');
      }

      const newAlert = await response.json();
      setAlerts((prev) => [newAlert, ...prev]);
      setShowAddModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create alert');
    } finally {
      setSubmitting(false);
    }
  };

  const deleteAlert = async (alertId: number) => {
    try {
      const response = await fetch('/api/price-alerts', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: alertId }),
      });

      if (!response.ok) throw new Error('Failed to delete alert');

      setAlerts((prev) => prev.filter((a) => a.id !== alertId));
    } catch (err) {
      setError('Failed to delete alert');
      console.error(err);
    }
  };

  const toggleAlert = async (alertId: number, isActive: boolean) => {
    try {
      const response = await fetch('/api/price-alerts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: alertId, isActive }),
      });

      if (!response.ok) throw new Error('Failed to update alert');

      await response.json();
      setAlerts((prev) => prev.map((a) => (a.id === alertId ? { ...a, isActive } : a)));
    } catch (err) {
      setError('Failed to update alert');
      console.error(err);
    }
  };

  const activeAlerts = alerts.filter((a) => a.isActive && !a.triggeredAt);
  const triggeredAlerts = alerts.filter((a) => a.triggeredAt);

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-500/10 rounded-lg">
            <Bell className="w-6 h-6 text-purple-500" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Price Alerts</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {activeAlerts.length} active alert{activeAlerts.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors font-medium"
        >
          <Plus className="w-4 h-4" />
          New Alert
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg text-sm"
        >
          {error}
        </motion.div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
          <span className="ml-3 text-gray-500">Loading alerts...</span>
        </div>
      )}

      {/* Empty State */}
      {!loading && alerts.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-xl"
        >
          <Bell className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No price alerts
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            Create alerts to get notified when tokens hit your target prices
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors font-medium"
          >
            <Plus className="w-4 h-4" />
            Create Your First Alert
          </button>
        </motion.div>
      )}

      {/* Active Alerts */}
      {!loading && activeAlerts.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Active Alerts</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <AnimatePresence>
              {activeAlerts.map((alert) => (
                <motion.div
                  key={alert.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 hover:shadow-lg transition-shadow"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center text-white font-bold text-sm">
                        {alert.coin.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900 dark:text-white">
                          {alert.coin.toUpperCase()}
                        </h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                          {alert.network}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => deleteAlert(alert.id)}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      title="Delete alert"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="mb-3">
                    <div className="flex items-center gap-2 text-sm">
                      {alert.condition === 'gt' ? (
                        <TrendingUp className="w-4 h-4 text-green-500" />
                      ) : (
                        <TrendingDown className="w-4 h-4 text-red-500" />
                      )}
                      <span className="text-gray-600 dark:text-gray-300">
                        {alert.condition === 'gt' ? 'Above' : 'Below'}
                      </span>
                      <span className="font-semibold text-gray-900 dark:text-white">
                        ${parseFloat(alert.targetPrice).toLocaleString()}
                      </span>
                    </div>
                    {alert.currentPrice && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Current: ${parseFloat(alert.currentPrice).toLocaleString()}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={alert.isActive}
                        onChange={(e) => toggleAlert(alert.id, e.target.checked)}
                        className="w-4 h-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500"
                      />
                      <span className="text-sm text-gray-600 dark:text-gray-400">Active</span>
                    </label>
                    <p className="text-xs text-gray-400">
                      {new Date(alert.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Triggered Alerts */}
      {!loading && triggeredAlerts.length > 0 && (
        <div className="mt-8 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Triggered Alerts</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {triggeredAlerts.map((alert) => (
              <div
                key={alert.id}
                className="bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 p-4 opacity-75"
              >
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="w-4 h-4 text-yellow-500" />
                  <span className="font-medium text-gray-900 dark:text-white">
                    {alert.coin.toUpperCase()}
                  </span>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Target: ${parseFloat(alert.targetPrice).toLocaleString()} ({alert.condition === 'gt' ? 'above' : 'below'})
                </p>
                <p className="text-xs text-gray-400 mt-2">
                  Triggered: {alert.triggeredAt ? new Date(alert.triggeredAt).toLocaleString() : 'N/A'}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Alert Modal */}
      <AddAlertModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSubmit={createAlert}
        isSubmitting={submitting}
      />
    </div>
  );
}

// Add Alert Modal Component
function AddAlertModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (coin: string, network: string, name: string, targetPrice: number, condition: 'gt' | 'lt') => void;
  isSubmitting: boolean;
}) {
  const [coin, setCoin] = useState('');
  const [network, setNetwork] = useState('');
  const [name, setName] = useState('');
  const [targetPrice, setTargetPrice] = useState('');
  const [condition, setCondition] = useState<'gt' | 'lt'>('gt');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!coin || !network || !name || !targetPrice) return;
    onSubmit(coin, network, name, parseFloat(targetPrice), condition);
  };

  if (!isOpen) return null;

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md">
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Create Price Alert
            </h3>
            <button
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Coin Symbol
              </label>
              <input
                type="text"
                value={coin}
                onChange={(e) => setCoin(e.target.value.toUpperCase())}
                placeholder="BTC"
                className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border-0 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Network
              </label>
              <select
                value={network}
                onChange={(e) => setNetwork(e.target.value)}
                className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border-0 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500"
                required
              >
                <option value="">Select network</option>
                <option value="bitcoin">Bitcoin</option>
                <option value="ethereum">Ethereum</option>
                <option value="solana">Solana</option>
                <option value="polygon">Polygon</option>
                <option value="avalanche">Avalanche</option>
                <option value="arbitrum">Arbitrum</option>
                <option value="optimism">Optimism</option>
                <option value="bsc">BNB Chain</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Token Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Bitcoin"
                className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border-0 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Target Price (USD)
              </label>
              <input
                type="number"
                step="any"
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value)}
                placeholder="50000"
                className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border-0 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Condition
              </label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="condition"
                    value="gt"
                    checked={condition === 'gt'}
                    onChange={() => setCondition('gt')}
                    className="w-4 h-4 text-purple-600 border-gray-300 focus:ring-purple-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Above</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="condition"
                    value="lt"
                    checked={condition === 'lt'}
                    onChange={() => setCondition('lt')}
                    className="w-4 h-4 text-purple-600 border-gray-300 focus:ring-purple-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Below</span>
                </label>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creating...
                  </span>
                ) : (
                  'Create Alert'
                )}
              </button>
            </div>
          </form>
        </div>
      </motion.div>
    </>
  );
}
