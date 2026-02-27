'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';

import WatchlistHeader from './WatchlistHeader';
import WatchlistGrid from './WatchlistGrid';
import EmptyState from './EmptyState';
import AddTokenModal from './AddTokenModal';
import { WatchlistItem } from './types';
import { dummyWatchlistItems } from './dummy-data';

interface WatchlistContainerProps {
  onSwap?: (coin: string, network: string) => void;
}

export default function WatchlistContainer({ onSwap }: WatchlistContainerProps) {
  // State
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch watchlist on mount
  useEffect(() => {
    fetchWatchlist();
  }, []);

  // Fetch watchlist from API (using dummy data for now)
  const fetchWatchlist = async () => {
    try {
      setLoading(true);
      
      // Try to fetch from API first
      try {
        const response = await fetch('/api/watchlist');
        if (response.ok) {
          const data = await response.json();
          // Transform API data to match our interface
          const transformedData = data.map((item: Record<string, unknown>) => ({
            id: String(item.id),
            name: item.name as string,
            symbol: item.coin as string,
            network: item.network as string,
            price: parseFloat(item.usdPrice as string) || 0,
            change24h: Math.random() * 10 - 5, // Placeholder until API provides this
            marketCap: undefined,
            volume24h: undefined,
            addedAt: item.addedAt as string,
          }));
          setItems(transformedData);
          setError(null);
          return;
        }
      } catch {
        // API not available, use dummy data
        console.log('API not available, using dummy data');
      }
      
      // Use dummy data as fallback
      setItems(dummyWatchlistItems);
      setError(null);
    } catch (err) {
      setError('Failed to load watchlist');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Refresh watchlist
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchWatchlist();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  // Add token to watchlist
  const handleAddToken = async (coin: string, network: string, name: string) => {
    try {
      // Try API first
      try {
        const response = await fetch('/api/watchlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ coin, network, name }),
        });
        
        if (response.ok) {
          const newItem = await response.json();
          const transformedItem: WatchlistItem = {
            id: String(newItem.id),
            name: newItem.name,
            symbol: newItem.coin,
            network: newItem.network,
            price: parseFloat(newItem.usdPrice) || 0,
            change24h: Math.random() * 10 - 5,
            addedAt: newItem.addedAt,
          };
          setItems((prev) => [transformedItem, ...prev]);
          return;
        }
      } catch {
        console.log('API not available, adding locally');
      }
      
      // Add locally if API fails
      const newItem: WatchlistItem = {
        id: `${coin}-${network}-${Date.now()}`,
        name,
        symbol: coin,
        network,
        price: Math.random() * 1000,
        change24h: Math.random() * 10 - 5,
        addedAt: new Date(),
      };
      setItems((prev) => [newItem, ...prev]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add token');
      throw err;
    }
  };

  // Remove token from watchlist
  const handleRemove = async (id: string) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;

    try {
      // Try API first
      try {
        const response = await fetch('/api/watchlist', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ coin: item.symbol, network: item.network }),
        });
        
        if (response.ok) {
          setItems((prev) => prev.filter((i) => i.id !== id));
          return;
        }
      } catch {
        console.log('API not available, removing locally');
      }
      
      // Remove locally if API fails
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch (err) {
      setError('Failed to remove token');
      console.error(err);
    }
  };

  // Handle swap action
  const handleSwap = useCallback((symbol: string, network: string) => {
    if (onSwap) {
      onSwap(symbol, network);
    } else {
      // Default: navigate to prices page with the token
      window.location.href = `/prices?from=${symbol}&network=${network}`;
    }
  }, [onSwap]);

  // Filter items based on search query
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    
    const query = searchQuery.toLowerCase();
    return items.filter(
      (item) =>
        item.name.toLowerCase().includes(query) ||
        item.symbol.toLowerCase().includes(query) ||
        item.network.toLowerCase().includes(query)
    );
  }, [items, searchQuery]);

  // Create a set of coins already in watchlist for the modal
  const watchlistCoins = useMemo(
    () => new Set(items.map((item) => `${item.symbol}-${item.network}`)),
    [items]
  );

  return (
    <div className="w-full max-w-6xl mx-auto">
      {/* Header */}
      <WatchlistHeader
        tokenCount={items.length}
        onAddToken={() => setIsModalOpen(true)}
        onRefresh={handleRefresh}
        onSearch={setSearchQuery}
        searchQuery={searchQuery}
        isRefreshing={isRefreshing}
      />

      {/* Error Message */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400"
        >
          {error}
        </motion.div>
      )}

      {/* Content */}
      {loading ? (
        <WatchlistGrid
          items={[]}
          onRemove={() => {}}
          onSwap={() => {}}
          loading={true}
        />
      ) : filteredItems.length === 0 ? (
        searchQuery ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12"
          >
            <p className="text-[rgb(var(--text-muted))]">
              No tokens found matching "{searchQuery}"
            </p>
          </motion.div>
        ) : (
          <EmptyState onAddToken={() => setIsModalOpen(true)} />
        )
      ) : (
        <WatchlistGrid
          items={filteredItems}
          onRemove={handleRemove}
          onSwap={handleSwap}
        />
      )}

      {/* Add Token Modal */}
      <AddTokenModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onAdd={handleAddToken}
        watchlistCoins={watchlistCoins}
      />
    </div>
  );
}
