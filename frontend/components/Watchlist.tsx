'use client';

import { useState, useEffect } from 'react';
import { Star, Trash2, RefreshCw, ArrowRightLeft, Plus, Search, X, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface WatchlistItem {
  id: number;
  userId: string;
  coin: string;
  network: string;
  name: string;
  addedAt: Date | string;
  usdPrice?: string | null;
  btcPrice?: string | null;
  lastUpdated?: Date | string | null;
}

interface WatchlistProps {
  onSwap?: (coin: string, network: string) => void;
}

export default function Watchlist({ onSwap }: WatchlistProps) {
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [availableCoins, setAvailableCoins] = useState<{ coin: string; network: string; name: string }[]>([]);
  const [addingToken, setAddingToken] = useState(false);

  // Fetch watchlist on mount
  useEffect(() => {
    fetchWatchlist();
  }, []);

  const fetchWatchlist = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/watchlist');
      if (!response.ok) throw new Error('Failed to fetch watchlist');
      const data = await response.json();
      setWatchlist(data);
      setError(null);
    } catch (err) {
      setError('Failed to load watchlist');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableCoins = async () => {
    try {
      const response = await fetch('/api/prices');
      if (!response.ok) throw new Error('Failed to fetch prices');
      const data = await response.json();
      // Transform to watchlist format
      const coins = data.map((item: { coin: string; network: string; name: string }) => ({
        coin: item.coin,
        network: item.network,
        name: item.name,
      }));
      setAvailableCoins(coins);
    } catch (err) {
      console.error('Failed to fetch available coins:', err);
    }
  };

  const handleAddClick = async () => {
    setShowAddModal(true);
    await fetchAvailableCoins();
  };

  const addToWatchlist = async (coin: string, network: string, name: string) => {
    try {
      setAddingToken(true);
      const response = await fetch('/api/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coin, network, name }),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to add to watchlist');
      }
      
      const newItem = await response.json();
      setWatchlist((prev) => [newItem, ...prev]);
      setShowAddModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add token');
    } finally {
      setAddingToken(false);
    }
  };

  const removeFromWatchlist = async (coin: string, network: string) => {
    try {
      const response = await fetch('/api/watchlist', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coin, network }),
      });
      
      if (!response.ok) throw new Error('Failed to remove from watchlist');
      
      setWatchlist((prev) => prev.filter((item) => !(item.coin === coin && item.network === network)));
    } catch (err) {
      setError('Failed to remove token');
      console.error(err);
    }
  };

  const handleSwap = (coin: string, network: string) => {
    if (onSwap) {
      onSwap(coin, network);
    } else {
      // Default: navigate to prices page with the token
      window.location.href = `/prices?from=${coin}&network=${network}`;
    }
  };

  const filteredCoins = availableCoins.filter(
    (c) =>
      c.coin.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.network.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Check if a coin is already in watchlist
  const isInWatchlist = (coin: string, network: string) =>
    watchlist.some((item) => item.coin === coin && item.network === network);

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-yellow-500/10 rounded-lg">
            <Star className="w-6 h-6 text-yellow-500" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Watchlist</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {watchlist.length} token{watchlist.length !== 1 ? 's' : ''} tracked
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchWatchlist}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            title="Refresh prices"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
          <button
            onClick={handleAddClick}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
          >
            <Plus className="w-4 h-4" />
            Add Token
          </button>
        </div>
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
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          <span className="ml-3 text-gray-500">Loading watchlist...</span>
        </div>
      )}

      {/* Empty State */}
      {!loading && watchlist.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-xl"
        >
          <Star className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No tokens in watchlist
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            Add tokens to track their prices and quickly swap
          </p>
          <button
            onClick={handleAddClick}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
          >
            <Plus className="w-4 h-4" />
            Add Your First Token
          </button>
        </motion.div>
      )}

      {/* Watchlist Grid */}
      {!loading && watchlist.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence>
            {watchlist.map((item) => (
              <motion.div
                key={`${item.coin}-${item.network}`}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 hover:shadow-lg transition-shadow"
              >
                {/* Token Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
                      {item.coin.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {item.coin.toUpperCase()}
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                        {item.network}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => removeFromWatchlist(item.coin, item.network)}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    title="Remove from watchlist"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Token Name */}
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-3 truncate">
                  {item.name}
                </p>

                {/* Price */}
                <div className="mb-3">
                  {item.usdPrice ? (
                    <div className="flex items-baseline gap-1">
                      <span className="text-xl font-bold text-gray-900 dark:text-white">
                        ${parseFloat(item.usdPrice).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: item.usdPrice && parseFloat(item.usdPrice) < 1 ? 6 : 2,
                        })}
                      </span>
                      {item.btcPrice && (
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          ₿{parseFloat(item.btcPrice).toFixed(8)}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-sm text-gray-400">Price unavailable</span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleSwap(item.coin, item.network)}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium"
                  >
                    <ArrowRightLeft className="w-4 h-4" />
                    Swap
                  </button>
                </div>

                {/* Added Date */}
                <p className="text-xs text-gray-400 mt-3">
                  Added {new Date(item.addedAt).toLocaleDateString()}
                </p>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Add Token Modal */}
      <AnimatePresence>
        {showAddModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-40"
              onClick={() => setShowAddModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
            >
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md max-h-[80vh] overflow-hidden">
                {/* Modal Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Add Token to Watchlist
                  </h3>
                  <button
                    onClick={() => setShowAddModal(false)}
                    className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Search */}
                <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search tokens..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 bg-gray-100 dark:bg-gray-700 border-0 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Token List */}
                <div className="overflow-y-auto max-h-96">
                  {filteredCoins.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                      No tokens found
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-200 dark:divide-gray-700">
                      {filteredCoins.map((token) => {
                        const alreadyAdded = isInWatchlist(token.coin, token.network);
                        return (
                          <button
                            key={`${token.coin}-${token.network}`}
                            onClick={() => !alreadyAdded && addToWatchlist(token.coin, token.network, token.name)}
                            disabled={alreadyAdded || addingToken}
                            className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
                                {token.coin.slice(0, 2).toUpperCase()}
                              </div>
                              <div className="text-left">
                                <p className="font-medium text-gray-900 dark:text-white">
                                  {token.coin.toUpperCase()}
                                </p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                  {token.name} • {token.network}
                                </p>
                              </div>
                            </div>
                            {alreadyAdded ? (
                              <span className="text-sm text-green-500 font-medium">
                                In Watchlist
                              </span>
                            ) : (
                              <Plus className="w-5 h-5 text-blue-600" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Loading Overlay */}
                {addingToken && (
                  <div className="absolute inset-0 bg-white/80 dark:bg-gray-800/80 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
