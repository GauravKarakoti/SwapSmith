'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, Plus, Loader2, Check } from 'lucide-react';

interface AvailableToken {
  coin: string;
  network: string;
  name: string;
  usdPrice?: string;
}

interface AddTokenModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (coin: string, network: string, name: string) => Promise<void>;
  watchlistCoins: Set<string>; // Set of "coin-network" strings already in watchlist
}

export default function AddTokenModal({
  isOpen,
  onClose,
  onAdd,
  watchlistCoins,
}: AddTokenModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [availableCoins, setAvailableCoins] = useState<AvailableToken[]>([]);
  const [loading, setLoading] = useState(false);
  const [addingToken, setAddingToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch available coins when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchAvailableCoins();
      setSearchQuery('');
      setError(null);
    }
  }, [isOpen]);

  const fetchAvailableCoins = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/prices');
      if (!response.ok) throw new Error('Failed to fetch prices');
      const data = await response.json();
      setAvailableCoins(data);
    } catch (err) {
      setError('Failed to load available tokens');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Filter coins based on search query
  const filteredCoins = useMemo(() => {
    if (!searchQuery.trim()) return availableCoins;
    
    const query = searchQuery.toLowerCase();
    return availableCoins.filter(
      (token) =>
        token.coin.toLowerCase().includes(query) ||
        token.name.toLowerCase().includes(query) ||
        token.network.toLowerCase().includes(query)
    );
  }, [availableCoins, searchQuery]);

  // Check if token is already in watchlist
  const isInWatchlist = (coin: string, network: string) =>
    watchlistCoins.has(`${coin}-${network}`);

  // Handle adding a token
  const handleAdd = async (coin: string, network: string, name: string) => {
    const key = `${coin}-${network}`;
    if (isInWatchlist(coin, network)) return;
    
    try {
      setAddingToken(key);
      await onAdd(coin, network, name);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add token');
    } finally {
      setAddingToken(null);
    }
  };

  // Handle keyboard close
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="relative w-full max-w-lg bg-[rgb(var(--bg-tertiary))] rounded-2xl border border-[rgb(var(--border-primary))] shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between p-5 border-b border-[rgb(var(--border-primary))]">
                <div>
                  <h3 className="text-xl font-bold text-[rgb(var(--text-primary))]">
                    Add Token
                  </h3>
                  <p className="text-sm text-[rgb(var(--text-secondary))] mt-0.5">
                    Select a token to add to your watchlist
                  </p>
                </div>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={onClose}
                  className="p-2 rounded-lg text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-primary))] hover:bg-[rgb(var(--border-primary))] transition-colors"
                >
                  <X className="w-5 h-5" />
                </motion.button>
              </div>

              {/* Search */}
              <div className="p-4 border-b border-[rgb(var(--border-primary))]">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[rgb(var(--text-muted))]" />
                  <input
                    type="text"
                    placeholder="Search by name, symbol, or network..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 rounded-xl bg-[rgb(var(--bg-secondary))] border border-[rgb(var(--border-primary))] text-[rgb(var(--text-primary))] placeholder:text-[rgb(var(--text-muted))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--accent-primary))]/30 transition-all"
                    autoFocus
                  />
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mx-4 mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm"
                >
                  {error}
                </motion.div>
              )}

              {/* Token List */}
              <div className="max-h-80 overflow-y-auto">
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 text-[rgb(var(--accent-primary))] animate-spin" />
                  </div>
                ) : filteredCoins.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-[rgb(var(--text-muted))]">
                    <Search className="w-10 h-10 mb-3 opacity-50" />
                    <p>No tokens found</p>
                    {searchQuery && (
                      <p className="text-sm mt-1">Try a different search term</p>
                    )}
                  </div>
                ) : (
                  <div className="divide-y divide-[rgb(var(--border-primary))]">
                    {filteredCoins.map((token) => {
                      const key = `${token.coin}-${token.network}`;
                      const alreadyAdded = isInWatchlist(token.coin, token.network);
                      const isAdding = addingToken === key;

                      return (
                        <motion.button
                          key={key}
                          whileHover={{ backgroundColor: 'rgb(var(--bg-secondary))' }}
                          onClick={() => handleAdd(token.coin, token.network, token.name)}
                          disabled={alreadyAdded || isAdding}
                          className={`w-full flex items-center justify-between p-4 transition-colors ${
                            alreadyAdded ? 'opacity-50 cursor-not-allowed' : ''
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            {/* Token Icon */}
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[rgb(var(--accent-primary))] to-[rgb(var(--accent-tertiary))] flex items-center justify-center text-white font-bold text-sm">
                              {token.coin.slice(0, 2).toUpperCase()}
                            </div>
                            
                            <div className="text-left">
                              <p className="font-semibold text-[rgb(var(--text-primary))]">
                                {token.coin.toUpperCase()}
                              </p>
                              <p className="text-sm text-[rgb(var(--text-secondary))]">
                                {token.name} • {token.network}
                              </p>
                            </div>
                          </div>

                          {/* Status indicator */}
                          <div className="flex items-center">
                            {alreadyAdded ? (
                              <span className="flex items-center gap-1 text-sm text-green-400 font-medium">
                                <Check className="w-4 h-4" />
                                Added
                              </span>
                            ) : isAdding ? (
                              <Loader2 className="w-5 h-5 text-[rgb(var(--accent-primary))] animate-spin" />
                            ) : (
                              <motion.div
                                whileHover={{ scale: 1.1 }}
                                className="p-2 rounded-lg text-[rgb(var(--accent-primary))] hover:bg-[rgb(var(--accent-primary))]/10"
                              >
                                <Plus className="w-5 h-5" />
                              </motion.div>
                            )}
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-[rgb(var(--border-primary))] bg-[rgb(var(--bg-secondary))]">
                <p className="text-xs text-[rgb(var(--text-muted))] text-center">
                  {filteredCoins.length} tokens available
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
