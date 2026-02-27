'use client';

import { useState, useEffect } from 'react';
import { Shield, Trash2, Plus, X, Loader2, TrendingDown, AlertCircle, Wallet, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface TrailingStopOrder {
  id: number;
  userId: string | null;
  fromAsset: string;
  fromNetwork: string;
  toAsset: string;
  toNetwork: string;
  fromAmount: string;
  trailingPercentage: number;
  peakPrice: string | null;
  currentPrice: string | null;
  triggerPrice: string | null;
  isActive: boolean;
  status: 'pending' | 'triggered' | 'completed' | 'cancelled' | 'expired' | 'failed';
  settleAddress: string | null;
  sideshiftOrderId: string | null;
  createdAt: Date | string;
  lastCheckedAt: Date | string | null;
  triggeredAt: Date | string | null;
}

interface TrailingStopManagerProps {
  onSwap?: (fromAsset: string, toAsset: string) => void;
}

export default function TrailingStopManager({ onSwap }: TrailingStopManagerProps) {
  const [orders, setOrders] = useState<TrailingStopOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Fetch orders on mount
  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/trailing-stop');
      if (!response.ok) throw new Error('Failed to fetch orders');
      const data = await response.json();
      setOrders(data);
      setError(null);
    } catch (err) {
      setError('Failed to load trailing stop orders');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const createOrder = async (
    fromAsset: string,
    fromNetwork: string,
    toAsset: string,
    toNetwork: string,
    fromAmount: number,
    trailingPercentage: number,
    settleAddress: string
  ) => {
    try {
      setSubmitting(true);
      const response = await fetch('/api/create-trailing-stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromAsset,
          fromNetwork,
          toAsset,
          toNetwork,
          fromAmount: fromAmount.toString(),
          trailingPercentage,
          settleAddress,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create order');
      }

      const newOrder = await response.json();
      setOrders((prev) => [newOrder.data, ...prev]);
      setShowAddModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create order');
    } finally {
      setSubmitting(false);
    }
  };

  const cancelOrder = async (orderId: number) => {
    try {
      const response = await fetch('/api/trailing-stop', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: orderId }),
      });

      if (!response.ok) throw new Error('Failed to cancel order');

      setOrders((prev) => prev.map((o) => 
        o.id === orderId ? { ...o, status: 'cancelled', isActive: false } : o
      ));
    } catch (err) {
      setError('Failed to cancel order');
      console.error(err);
    }
  };

  const activeOrders = orders.filter((o) => o.isActive && o.status === 'pending');
  const triggeredOrders = orders.filter((o) => o.status === 'triggered' || o.status === 'completed');
  const cancelledOrders = orders.filter((o) => o.status === 'cancelled' || o.status === 'expired' || o.status === 'failed');

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-500/10 rounded-lg">
            <Shield className="w-6 h-6 text-green-500" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Trailing Stop Orders</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {activeOrders.length} active order{activeOrders.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-medium"
        >
          <Plus className="w-4 h-4" />
          New Order
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
          <Loader2 className="w-8 h-8 text-green-600 animate-spin" />
          <span className="ml-3 text-gray-500">Loading orders...</span>
        </div>
      )}

      {/* Empty State */}
      {!loading && orders.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-xl"
        >
          <Shield className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No trailing stop orders
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            Create trailing stop orders to automatically protect your profits
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-medium"
          >
            <Plus className="w-4 h-4" />
            Create Your First Order
          </button>
        </motion.div>
      )}

      {/* Active Orders */}
      {!loading && activeOrders.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Active Orders</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <AnimatePresence>
              {activeOrders.map((order) => (
                <motion.div
                  key={order.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 hover:shadow-lg transition-shadow"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white font-bold text-sm">
                        {order.fromAsset.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900 dark:text-white">
                          {order.fromAsset.toUpperCase()}
                        </h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          → {order.toAsset.toUpperCase()}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => cancelOrder(order.id)}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      title="Cancel order"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-2 mb-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500 dark:text-gray-400">Amount:</span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {order.fromAmount} {order.fromAsset.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500 dark:text-gray-400">Trailing:</span>
                      <span className="font-medium text-red-500">
                        <TrendingDown className="w-3 h-3 inline mr-1" />
                        {order.trailingPercentage}%
                      </span>
                    </div>
                    {order.peakPrice && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500 dark:text-gray-400">Peak Price:</span>
                        <span className="font-medium text-green-600">
                          ${parseFloat(order.peakPrice).toLocaleString()}
                        </span>
                      </div>
                    )}
                    {order.triggerPrice && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500 dark:text-gray-400">Trigger At:</span>
                        <span className="font-medium text-red-600">
                          ${parseFloat(order.triggerPrice).toLocaleString()}
                        </span>
                      </div>
                    )}
                    {order.currentPrice && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500 dark:text-gray-400">Current:</span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          ${parseFloat(order.currentPrice).toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-700">
                    <span className="text-xs text-gray-400">
                      Created: {new Date(order.createdAt).toLocaleDateString()}
                    </span>
                    <span className="px-2 py-1 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full">
                      Active
                    </span>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Triggered/Completed Orders */}
      {!loading && triggeredOrders.length > 0 && (
        <div className="mt-8 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Triggered & Completed</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {triggeredOrders.map((order) => (
              <div
                key={order.id}
                className="bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 p-4 opacity-75"
              >
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="w-4 h-4 text-yellow-500" />
                  <span className="font-medium text-gray-900 dark:text-white">
                    {order.fromAsset.toUpperCase()} → {order.toAsset.toUpperCase()}
                  </span>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Amount: {order.fromAmount} {order.fromAsset.toUpperCase()}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Trailing: {order.trailingPercentage}%
                </p>
                {order.sideshiftOrderId && (
                  <p className="text-xs text-gray-400 mt-2">
                    Order ID: {order.sideshiftOrderId}
                  </p>
                )}
                <p className="text-xs text-gray-400 mt-2">
                  {order.triggeredAt ? `Triggered: ${new Date(order.triggeredAt).toLocaleString()}` : `Status: ${order.status}`}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cancelled/Expired Orders */}
      {!loading && cancelledOrders.length > 0 && (
        <div className="mt-8 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Cancelled & Expired</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {cancelledOrders.map((order) => (
              <div
                key={order.id}
                className="bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 p-4 opacity-50"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-medium text-gray-500 dark:text-gray-400">
                    {order.fromAsset.toUpperCase()} → {order.toAsset.toUpperCase()}
                  </span>
                </div>
                <p className="text-sm text-gray-400">
                  Status: <span className="capitalize">{order.status}</span>
                </p>
                <p className="text-xs text-gray-400 mt-2">
                  Created: {new Date(order.createdAt).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Order Modal */}
      <AddOrderModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSubmit={createOrder}
        isSubmitting={submitting}
      />
    </div>
  );
}

// Add Order Modal Component
function AddOrderModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (fromAsset: string, fromNetwork: string, toAsset: string, toNetwork: string, fromAmount: number, trailingPercentage: number, settleAddress: string) => void;
  isSubmitting: boolean;
}) {
  const [fromAsset, setFromAsset] = useState('');
  const [fromNetwork, setFromNetwork] = useState('ethereum');
  const [toAsset, setToAsset] = useState('USDC');
  const [toNetwork, setToNetwork] = useState('ethereum');
  const [fromAmount, setFromAmount] = useState('');
  const [trailingPercentage, setTrailingPercentage] = useState('5');
  const [settleAddress, setSettleAddress] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fromAsset || !fromAmount || !trailingPercentage || !settleAddress) return;
    onSubmit(
      fromAsset.toUpperCase(),
      fromNetwork,
      toAsset.toUpperCase(),
      toNetwork,
      parseFloat(fromAmount),
      parseFloat(trailingPercentage),
      settleAddress
    );
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
              Create Trailing Stop Order
            </h3>
            <button
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  From Asset
                </label>
                <input
                  type="text"
                  value={fromAsset}
                  onChange={(e) => setFromAsset(e.target.value.toUpperCase())}
                  placeholder="ETH"
                  className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border-0 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-green-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  To Asset
                </label>
                <input
                  type="text"
                  value={toAsset}
                  onChange={(e) => setToAsset(e.target.value.toUpperCase())}
                  placeholder="USDC"
                  className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border-0 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-green-500"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  From Network
                </label>
                <select
                  value={fromNetwork}
                  onChange={(e) => setFromNetwork(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border-0 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500"
                >
                  <option value="ethereum">Ethereum</option>
                  <option value="bitcoin">Bitcoin</option>
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
                  To Network
                </label>
                <select
                  value={toNetwork}
                  onChange={(e) => setToNetwork(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border-0 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500"
                >
                  <option value="ethereum">Ethereum</option>
                  <option value="bitcoin">Bitcoin</option>
                  <option value="solana">Solana</option>
                  <option value="polygon">Polygon</option>
                  <option value="avalanche">Avalanche</option>
                  <option value="arbitrum">Arbitrum</option>
                  <option value="optimism">Optimism</option>
                  <option value="bsc">BNB Chain</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Amount to Sell
              </label>
              <input
                type="number"
                step="any"
                value={fromAmount}
                onChange={(e) => setFromAmount(e.target.value)}
                placeholder="1.5"
                className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border-0 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-green-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Trailing Percentage (%)
              </label>
              <input
                type="number"
                step="0.1"
                min="0.1"
                max="50"
                value={trailingPercentage}
                onChange={(e) => setTrailingPercentage(e.target.value)}
                placeholder="5"
                className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border-0 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-green-500"
                required
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Order will trigger when price drops this % from the peak
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                <Wallet className="w-4 h-4 inline mr-1" />
                Destination Address
              </label>
              <input
                type="text"
                value={settleAddress}
                onChange={(e) => setSettleAddress(e.target.value)}
                placeholder="0x..."
                className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border-0 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-green-500"
                required
              />
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                <strong>How it works:</strong> This order will track the highest price of {fromAsset || 'your asset'}. 
                If the price drops by {trailingPercentage || '5'}% from that peak, your {fromAmount || 'specified amount'} will be automatically swapped to {toAsset}.
              </p>
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
                className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creating...
                  </span>
                ) : (
                  'Create Order'
                )}
              </button>
            </div>
          </form>
        </div>
      </motion.div>
    </>
  );
}
