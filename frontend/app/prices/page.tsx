'use client'

import { useState, useEffect, useMemo } from 'react';
import { AlertCircle, RefreshCw, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';
import CoinCard from '@/components/CoinCard';
import SearchBar from '@/components/SearchBar';
import CoinCardSkeleton from '@/components/CoinCardSkeleton';
import Navbar from '@/components/Navbar';
import TopCryptoSection from '@/components/TopCryptoSection';
import { useCachedPrices } from '@/hooks/useCachedData';
import { clearAllCache, cleanExpiredCache } from '@/lib/cache-utils';
import Footer from '@/components/Footer';

export default function PricesPage() {
  const { data: coins, isLoading: loading, error: fetchError, refetch } = useCachedPrices();
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'price' | 'symbol'>('name');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [mockChanges, setMockChanges] = useState<Map<string, number>>(new Map());

  // Clean expired cache on mount
  useEffect(() => {
    const cleaned = cleanExpiredCache();
    if (cleaned > 0) {
      console.log(`[Prices Page] Cleaned ${cleaned} expired cache entries`);
    }
  }, []);

  // Set error from fetch error
  useEffect(() => {
    if (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to fetch cryptocurrency prices');
    }
  }, [fetchError]);

  // Generate mock 24h changes when coins are loaded
  useEffect(() => {
    if (coins?.prices && coins.prices.length > 0) {
      const changes = new Map<string, number>();
      coins.prices.forEach(coin => {
        const key = `${coin.coin}-${coin.network}`;
        changes.set(key, Math.random() * 20 - 10);
      });
      setMockChanges(changes);
    }
  }, [coins]);

  // Manual refresh handler
  const handleRefresh = async () => {
    setIsRefreshing(true);
    setError(null);
    try {
      // Clear all cache to force fresh data
      clearAllCache();
      console.log('[Prices Page] Cache cleared, refetching...');
      await refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh prices');
    } finally {
      setIsRefreshing(false);
    }
  };

  // Filter and sort coins
  const filteredAndSortedCoins = useMemo(() => {
    if (!coins?.prices || coins.prices.length === 0) return [];
    
    let filtered = coins.prices;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = coins.prices.filter(
        (coin) =>
          coin.name.toLowerCase().includes(query) ||
          coin.coin.toLowerCase().includes(query) ||
          coin.network.toLowerCase().includes(query)
      );
    }

    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'symbol':
          return a.coin.localeCompare(b.coin);
        case 'price':
          const priceA = parseFloat(a.usdPrice || '0');
          const priceB = parseFloat(b.usdPrice || '0');
          return priceB - priceA;
        default:
          return 0;
      }
    });

    return sorted;
  }, [coins, searchQuery, sortBy]);

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 pt-16 sm:pt-20">
        <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-8 h-8 text-blue-600" />
              <motion.h1
                initial={{ scale: 0.95, opacity: 0.7 }}
                animate={{ scale: 1, opacity: 1 }}
                whileHover={{ scale: 1.08, color: '#22d3ee', textShadow: '0 2px 20px #22d3ee' }}
                transition={{ type: 'spring', stiffness: 120, damping: 10 }}
                className="text-4xl font-bold text-gray-900 dark:text-white cursor-pointer transition-colors duration-300"
              >
                Live Crypto Prices
              </motion.h1>
              
            </div>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg transition-colors duration-200"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
          <p className="text-gray-600 dark:text-gray-400">
            Real-time cryptocurrency prices from database cache (6-hour refresh)
          </p>
        </div>

        {/* Featured Cryptocurrencies Section Motion */}
        <motion.div
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 80, damping: 14 }}
        >
          <h2 className="text-2xl font-bold text-blue-500 dark:text-cyan-300 mb-2 mt-2 hover:text-pink-500 transition-colors duration-300 cursor-pointer">
            Featured Cryptocurrencies
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            Top performing assets with 100-day price history
          </p>
          {!loading && !error && coins?.prices && coins.prices.length > 0 && (
            <TopCryptoSection 
              coins={filteredAndSortedCoins.filter(c => c.usdPrice).map(coin => {
                const key = `${coin.coin}-${coin.network}`;
                return {
                  ...coin,
                  usdPrice: coin.usdPrice!,
                  change24h: mockChanges.get(key) ?? 0,
                };
              })} 
            />
          )}
        </motion.div>

        {/* Search Bar */}
        {!loading && !error && (
          <SearchBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            sortBy={sortBy}
            onSortChange={setSortBy}
            totalCoins={coins?.prices?.length || 0}
            filteredCount={filteredAndSortedCoins.length}
          />
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 mb-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-lg font-semibold text-red-900 dark:text-red-200 mb-1">
                  Error Loading Prices
                </h3>
                <p className="text-red-700 dark:text-red-300 mb-4">{error}</p>
                <button
                  onClick={handleRefresh}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors duration-200"
                >
                  Try Again
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && !error && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(12)].map((_, i) => (
              <CoinCardSkeleton key={i} />
            ))}
          </div>
        )}

        {/* Coins Grid */}
        {!loading && !error && filteredAndSortedCoins.length > 0 && (
          <motion.div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6 }}
          >
            {filteredAndSortedCoins.map((coin, index) => (
              <motion.div
                key={`${coin.coin}-${coin.network}-${index}`}
                whileHover={{ scale: 1.04, boxShadow: '0 4px 24px #38bdf8' }}
                transition={{ type: 'spring', stiffness: 120, damping: 12 }}
              >
                <CoinCard
                  coin={coin.coin}
                  name={coin.name}
                  network={coin.network}
                  usdPrice={coin.usdPrice}
                  available={coin.available}
                />
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* No Results */}
        {!loading && !error && filteredAndSortedCoins.length === 0 && coins?.prices && coins.prices.length > 0 && (
          <div className="text-center py-12">
            <div className="inline-block p-4 bg-gray-100 dark:bg-gray-800 rounded-full mb-4">
              <AlertCircle className="w-12 h-12 text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              No coins found
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Try adjusting your search query
            </p>
            <button
              onClick={() => setSearchQuery('')}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors duration-200"
            >
              Clear Search
            </button>
          </div>
        )}

        {/* Footer Note */}
        {!loading && !error && coins?.prices && coins.prices.length > 0 && (
          <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              💡 <strong>Note:</strong> Cached prices from database (auto-refreshes every 6 hours). 
              Click the refresh button to force update from SideShift API.
            </p>
          </div>
        )}
        </div>
      </div>
     <Footer />
    </>
  );
}