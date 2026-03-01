'use client';

import { useState, useEffect } from 'react';
import { 
  PieChart, 
  TrendingUp, 
  Plus, 
  Trash2, 
  Loader2,
  AlertCircle,
  CheckCircle,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface PortfolioAsset {
  coin: string;
  network: string;
  targetPercentage: number;
}

interface PortfolioTarget {
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

interface RebalanceHistory {
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

export default function PortfolioRebalance() {
  const [portfolios, setPortfolios] = useState<PortfolioTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedPortfolio, setSelectedPortfolio] = useState<PortfolioTarget | null>(null);
  const [history, setHistory] = useState<RebalanceHistory[]>([]);

  useEffect(() => {
    fetchPortfolios();
  }, []);

  const fetchPortfolios = async () => {
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
  };

  const createPortfolio = async (
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

      const newPortfolio = await response.json();
      setPortfolios((prev) => [newPortfolio, ...prev]);
      setShowAddModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create portfolio');
    } finally {
      setSubmitting(false);
    }
  };

  const deletePortfolio = async (id: number) => {
    try {
      const response = await fetch('/api/portfolio-targets', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });

      if (!response.ok) throw new Error('Failed to delete portfolio');

      setPortfolios((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      setError('Failed to delete portfolio');
      console.error(err);
    }
  };

  const togglePortfolio = async (id: number, isActive: boolean) => {
    try {
      const response = await fetch('/api/portfolio-targets', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, isActive }),
      });

      if (!response.ok) throw new Error('Failed to update portfolio');

      const updated = await response.json();
      setPortfolios((prev) => prev.map((p) => (p.id === id ? updated : p)));
    } catch (err) {
      setError('Failed to update portfolio');
      console.error(err);
    }
  };

  const fetchHistory = async (portfolioId: number) => {
    try {
      const response = await fetch(`/api/portfolio-targets?id=${portfolioId}`);
      if (!response.ok) throw new Error('Failed to fetch history');
      const data = await response.json();
      setHistory(data.history || []);
    } catch (err) {
      console.error('Failed to fetch history:', err);
    }
  };

  const activePortfolios = portfolios.filter((p) => p.isActive);

  return (
    <div className="w-full max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl">
            <PieChart className="w-8 h-8 text-white" />
          </div>
          <div>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
              Portfolio Rebalancing
            </h2>
            <p className="text-gray-500 dark:text-gray-400">
              {activePortfolios.length} active portfolio{activePortfolios.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors font-medium shadow-lg shadow-blue-600/25"
        >
          <Plus className="w-5 h-5" />
          New Portfolio
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-4 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-xl flex items-center gap-3"
        >
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto">
            <X className="w-5 h-5" />
          </button>
        </motion.div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
          <span className="ml-3 text-gray-500">Loading portfolios...</span>
        </div>
      )}

      {/* Empty State */}
      {!loading && portfolios.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-20 bg-gray-50 dark:bg-gray-800/50 rounded-2xl"
        >
          <div className="w-20 h-20 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-6">
            <PieChart className="w-10 h-10 text-gray-400" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
            No portfolios yet
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
            Create your first portfolio target to automatically rebalance your crypto holdings when they drift from your desired allocation.
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors font-medium"
          >
            <Plus className="w-5 h-5" />
            Create Your First Portfolio
          </button>
        </motion.div>
      )}

      {/* Portfolio Cards */}
      {!loading && portfolios.length > 0 && (
        <div className="grid gap-6 md:grid-cols-2">
          <AnimatePresence>
            {portfolios.map((portfolio) => (
              <motion.div
                key={portfolio.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 hover:shadow-xl transition-shadow"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {portfolio.name}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {portfolio.assets.length} assets • {portfolio.driftThreshold}% threshold
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {portfolio.autoRebalance && (
                      <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs font-medium rounded-full">
                        Auto
                      </span>
                    )}
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={portfolio.isActive}
                        onChange={(e) => togglePortfolio(portfolio.id, e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                </div>

                {/* Asset Allocation */}
                <div className="mb-4">
                  <div className="flex flex-wrap gap-2">
                    {portfolio.assets.map((asset, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300"
                      >
                        {asset.coin}: {asset.targetPercentage}%
                      </span>
                    ))}
                  </div>
                </div>

                {/* Last Rebalanced */}
                {portfolio.lastRebalancedAt && (
                  <p className="text-xs text-gray-400 mb-4">
                    Last rebalanced: {new Date(portfolio.lastRebalancedAt).toLocaleDateString()}
                  </p>
                )}

                {/* Actions */}
                <div className="flex items-center gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
                  <button
                    onClick={() => {
                      setSelectedPortfolio(portfolio);
                      fetchHistory(portfolio.id);
                    }}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                  >
                    <TrendingUp className="w-4 h-4" />
                    View Details
                  </button>
                  <button
                    onClick={() => deletePortfolio(portfolio.id)}
                    className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                    title="Delete portfolio"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Add Portfolio Modal */}
      <AddPortfolioModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSubmit={createPortfolio}
        isSubmitting={submitting}
      />

      {/* Portfolio Details Modal */}
      {selectedPortfolio && (
        <PortfolioDetailsModal
          portfolio={selectedPortfolio}
          history={history}
          onClose={() => setSelectedPortfolio(null)}
        />
      )}
    </div>
  );
}

// Add Portfolio Modal Component
function AddPortfolioModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (name: string, assets: PortfolioAsset[], driftThreshold: number, autoRebalance: boolean) => void;
  isSubmitting: boolean;
}) {
  const [name, setName] = useState('');
  const [assets, setAssets] = useState<PortfolioAsset[]>([
    { coin: 'BTC', network: 'bitcoin', targetPercentage: 50 },
    { coin: 'ETH', network: 'ethereum', targetPercentage: 30 },
    { coin: 'USDC', network: 'ethereum', targetPercentage: 20 },
  ]);
  const [driftThreshold, setDriftThreshold] = useState(5);
  const [autoRebalance, setAutoRebalance] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate percentages sum to 100
    const total = assets.reduce((sum, a) => sum + a.targetPercentage, 0);
    if (Math.abs(total - 100) > 0.1) {
      alert(`Asset percentages must sum to 100% (Current: ${total}%)`);
      return;
    }

    onSubmit(name, assets, driftThreshold, autoRebalance);
  };

  const addAsset = () => {
    setAssets([...assets, { coin: '', network: 'ethereum', targetPercentage: 0 }]);
  };

  const updateAsset = (index: number, field: keyof PortfolioAsset, value: PortfolioAsset[keyof PortfolioAsset]) => {
    const newAssets = [...assets];
    newAssets[index] = { ...newAssets[index], [field]: value };
    setAssets(newAssets);
  };

  const removeAsset = (index: number) => {
    setAssets(assets.filter((_, i) => i !== index));
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
        className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
      >
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg my-8">
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
              Create Portfolio Target
            </h3>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {/* Portfolio Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Portfolio Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Conservative, Balanced, Growth"
                className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 border-0 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            {/* Asset Allocation */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Asset Allocation
                </label>
                <button
                  type="button"
                  onClick={addAsset}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  + Add Asset
                </button>
              </div>
              <div className="space-y-3">
                {assets.map((asset, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <input
                      type="text"
                      value={asset.coin}
                      onChange={(e) => updateAsset(index, 'coin', e.target.value.toUpperCase())}
                      placeholder="BTC"
                      className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-700 border-0 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500"
                      required
                    />
                    <select
                      value={asset.network}
                      onChange={(e) => updateAsset(index, 'network', e.target.value)}
                      className="px-3 py-2 bg-gray-100 dark:bg-gray-700 border-0 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="bitcoin">Bitcoin</option>
                      <option value="ethereum">Ethereum</option>
                      <option value="polygon">Polygon</option>
                      <option value="arbitrum">Arbitrum</option>
                      <option value="optimism">Optimism</option>
                      <option value="avalanche">Avalanche</option>
                      <option value="solana">Solana</option>
                    </select>
                    <div className="flex items-center gap-1 w-24">
                      <input
                        type="number"
                        value={asset.targetPercentage}
                        onChange={(e) => updateAsset(index, 'targetPercentage', parseFloat(e.target.value) || 0)}
                        min="0"
                        max="100"
                        className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border-0 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                        required
                      />
                      <span className="text-gray-400">%</span>
                    </div>
                    {assets.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeAsset(index)}
                        className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <p className="mt-2 text-sm text-gray-500">
                Total: {assets.reduce((sum, a) => sum + a.targetPercentage, 0)}%
              </p>
            </div>

            {/* Drift Threshold */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Drift Threshold (%)
              </label>
              <input
                type="number"
                value={driftThreshold}
                onChange={(e) => setDriftThreshold(parseFloat(e.target.value) || 5)}
                min="1"
                max="50"
                className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 border-0 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              />
              <p className="mt-1 text-xs text-gray-500">
                Rebalance when any asset drifts beyond this percentage
              </p>
            </div>

            {/* Auto Rebalance */}
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Auto Rebalance</p>
                <p className="text-sm text-gray-500">Automatically rebalance when threshold is exceeded</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoRebalance}
                  onChange={(e) => setAutoRebalance(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
              </label>
            </div>

            {/* Submit Button */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Creating...
                  </span>
                ) : (
                  'Create Portfolio'
                )}
              </button>
            </div>
          </form>
        </div>
      </motion.div>
    </>
  );
}

// Portfolio Details Modal Component
function PortfolioDetailsModal({
  portfolio,
  history,
  onClose,
}: {
  portfolio: PortfolioTarget;
  history: RebalanceHistory[];
  onClose: () => void;
}) {
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
        className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
      >
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl my-8">
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                {portfolio.name}
              </h3>
              <p className="text-sm text-gray-500">
                {portfolio.driftThreshold}% drift threshold • {portfolio.autoRebalance ? 'Auto-rebalance enabled' : 'Manual rebalance'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-6">
            {/* Asset Allocation */}
            <div>
              <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">
                Target Allocation
              </h4>
              <div className="flex flex-wrap gap-3">
                {portfolio.assets.map((asset, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg"
                  >
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {asset.coin}
                    </span>
                    <span className="text-gray-500">on {asset.network}</span>
                    <span className="ml-2 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded text-sm font-medium">
                      {asset.targetPercentage}%
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Rebalance History */}
            <div>
              <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">
                Rebalance History
              </h4>
              {history.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-sm">
                  No rebalancing history yet
                </p>
              ) : (
                <div className="space-y-3">
                  {history.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl"
                    >
                      <div className="flex items-center gap-3">
                        {item.status === 'completed' ? (
                          <CheckCircle className="w-5 h-5 text-green-500" />
                        ) : item.status === 'failed' ? (
                          <AlertCircle className="w-5 h-5 text-red-500" />
                        ) : (
                          <Loader2 className="w-5 h-5 text-yellow-500 animate-spin" />
                        )}
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {item.triggerType.charAt(0).toUpperCase() + item.triggerType.slice(1)} Rebalance
                          </p>
                          <p className="text-sm text-gray-500">
                            {new Date(item.startedAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          ${parseFloat(item.totalPortfolioValue).toLocaleString()}
                        </p>
                        <p className="text-xs text-gray-500">
                          {item.swapsExecuted.length} swaps
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </>
  );
}
