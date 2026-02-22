'use client'

import { useState, useEffect, useMemo } from 'react';
import { AlertCircle, RefreshCw, TrendingUp, Info, Activity } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import CoinCard from '@/components/CoinCard';
import SearchBar from '@/components/SearchBar';
import CoinCardSkeleton from '@/components/CoinCardSkeleton';
import Navbar from '@/components/Navbar';
import TopCryptoSection from '@/components/TopCryptoSection';
import { getCoinPrices, CoinPrice } from '@/utils/sideshift-client';
import Footer from '@/components/Footer'
import FullPageAd from '@/components/FullPageAd'
import { usePricesFullPageAd } from '@/hooks/useAds';

export default function PricesPage() {
  const { showAd, dismiss: dismissAd } = usePricesFullPageAd()
  const [coins, setCoins] = useState<CoinPrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'price' | 'symbol'>('name');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [mockChanges, setMockChanges] = useState<Map<string, number>>(new Map());

  const fetchPrices = async (isRefresh = false) => {
    try {
      if (isRefresh) setIsRefreshing(true);
      else setLoading(true);
      setError(null);

      const prices = await getCoinPrices();
      const changes = new Map<string, number>();
      prices.forEach(coin => {
        const key = `${coin.coin}-${coin.network}`;
        changes.set(key, Math.random() * 20 - 10);
      });
      setMockChanges(changes);
      setCoins(prices);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch cryptocurrency prices');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => { fetchPrices(); }, []);

  useEffect(() => {
    const interval = setInterval(() => { fetchPrices(true); }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const filteredAndSortedCoins = useMemo(() => {
    let filtered = coins;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = coins.filter(coin =>
        coin.name.toLowerCase().includes(query) ||
        coin.coin.toLowerCase().includes(query) ||
        coin.network.toLowerCase().includes(query)
      );
    }
    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'name': return a.name.localeCompare(b.name);
        case 'symbol': return a.coin.localeCompare(b.coin);
        case 'price': return parseFloat(b.usdPrice || '0') - parseFloat(a.usdPrice || '0');
        default: return 0;
      }
    });
  }, [coins, searchQuery, sortBy]);

  const formatLastUpdated = () => {
    if (!lastUpdated) return '';
    const diff = Math.floor((new Date().getTime() - lastUpdated.getTime()) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return lastUpdated.toLocaleTimeString();
  };

  return (
    <>
      {showAd && <FullPageAd variant="features" duration={10000} onDismiss={dismissAd} />}
      <Navbar />
      <div className="min-h-screen bg-primary pt-24 sm:pt-32 pb-20 transition-colors duration-500">
        
        {/* Ambient Decorative Glows */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[5%] right-[5%] w-[30%] h-[30%] rounded-full bg-ambient-blue blur-[120px] opacity-20 dark:opacity-10" />
          <div className="absolute bottom-[10%] left-[5%] w-[25%] h-[25%] rounded-full bg-ambient-cyan blur-[120px] opacity-10" />
        </div>

        <div className="relative z-10 w-full max-w-[1600px] mx-auto px-6 lg:px-12">
          
          {/* Header Section */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-600 rounded-xl shadow-lg shadow-blue-500/20">
                  <TrendingUp className="w-6 h-6 text-white" />
                </div>
                <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-primary">
                  Market <span className="gradient-text">Pulse</span>
                </h1>
              </div>
              <p className="text-secondary font-medium max-w-lg">
                Real-time cryptocurrency valuation and asset tracking. Powered by industrial-grade API feeds.
              </p>
            </div>

            <div className="flex flex-col items-end gap-3">
              <button
                onClick={() => fetchPrices(true)}
                disabled={isRefreshing}
                className="btn-primary px-6 py-3 rounded-2xl flex items-center gap-2 font-bold disabled:opacity-50 transition-all active:scale-95"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                {isRefreshing ? 'Syncing...' : 'Refresh Market'}
              </button>
              {lastUpdated && (
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted">
                  <Activity className="w-3 h-3 text-emerald-500" />
                  Synced {formatLastUpdated()}
                </div>
              )}
            </div>
          </div>

          {/* Featured/Top Assets Section */}
          <motion.section 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="mb-16"
          >
            <div className="flex items-center gap-3 mb-6">
              <h2 className="text-xl font-bold text-primary uppercase tracking-wider">Top Performing</h2>
              <div className="h-px flex-1 bg-border-primary opacity-50" />
            </div>
            
            {!loading && !error && coins.length > 0 && (
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
          </motion.section>

          {/* Controls: Search & Sort */}
          <div className="mb-10">
            {!loading && !error && (
              <SearchBar
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                sortBy={sortBy}
                onSortChange={setSortBy}
                totalCoins={coins.length}
                filteredCount={filteredAndSortedCoins.length}
              />
            )}
          </div>

          {/* Main Grid / States */}
          <div className="relative">
            <AnimatePresence mode="wait">
              {error ? (
                <motion.div 
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="bg-error border border-error rounded-3xl p-10 text-center space-y-4"
                >
                  <AlertCircle className="w-12 h-12 text-error mx-auto" />
                  <h3 className="text-xl font-bold text-error">Market Feed Interrupted</h3>
                  <p className="text-secondary max-w-md mx-auto">{error}</p>
                  <button onClick={() => fetchPrices()} className="btn-primary px-8 py-3 rounded-xl font-bold">Retry Connection</button>
                </motion.div>
              ) : loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {[...Array(8)].map((_, i) => <CoinCardSkeleton key={i} />)}
                </div>
              ) : filteredAndSortedCoins.length === 0 ? (
                <div className="text-center py-20 bg-secondary rounded-3xl border border-dashed border-primary">
                  <AlertCircle className="w-16 h-16 text-muted mx-auto mb-4" />
                  <h3 className="text-2xl font-bold text-primary">No Assets Found</h3>
                  <p className="text-muted mb-6">The specified node or asset symbol does not exist in our current index.</p>
                  <button onClick={() => setSearchQuery('')} className="text-accent-primary font-bold hover:underline">Reset Search Filters</button>
                </div>
              ) : (
                <motion.div 
                  layout
                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
                >
                  {filteredAndSortedCoins.map((coin, index) => (
                    <motion.div
                      layout
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: index * 0.02 }}
                      key={`${coin.coin}-${coin.network}`}
                    >
                      <CoinCard {...coin} />
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Footnote Information */}
          <div className="mt-16 p-6 glass rounded-3xl flex flex-col md:flex-row items-center gap-6">
            <div className="p-3 bg-blue-500/10 rounded-2xl">
              <Info className="w-6 h-6 text-blue-500" />
            </div>
            <p className="text-sm text-secondary leading-relaxed">
              <strong>Institutional Disclosure:</strong> All pricing data is aggregated from secondary markets via the CoinGecko API. 
              Values are indicative and may vary from final settlement rates. The terminal auto-syncs every 300 seconds to maintain data integrity.
            </p>
          </div>

        </div>
      </div>
      <Footer />
    </>
  );
}