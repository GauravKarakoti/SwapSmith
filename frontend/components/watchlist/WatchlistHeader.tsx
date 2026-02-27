'use client';

import { motion } from 'framer-motion';
import { Star, Plus, RefreshCw, Search } from 'lucide-react';
import { useState } from 'react';

interface WatchlistHeaderProps {
  tokenCount: number;
  onAddToken: () => void;
  onRefresh: () => void;
  onSearch: (query: string) => void;
  searchQuery: string;
  isRefreshing?: boolean;
}

export default function WatchlistHeader({
  tokenCount,
  onAddToken,
  onRefresh,
  onSearch,
  searchQuery,
  isRefreshing = false,
}: WatchlistHeaderProps) {
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="mb-8"
    >
      {/* Main Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          {/* Icon */}
          <motion.div
            whileHover={{ scale: 1.05, rotate: 5 }}
            className="p-3 rounded-2xl bg-gradient-to-br from-yellow-400/20 to-orange-500/20 border border-yellow-500/20"
          >
            <Star className="w-7 h-7 text-yellow-400 fill-yellow-400" />
          </motion.div>
          
          {/* Title & Subtitle */}
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-white via-white to-gray-400 bg-clip-text text-transparent">
              Watchlist
            </h1>
            <p className="text-[rgb(var(--text-secondary))] text-sm mt-0.5">
              Track your favorite assets in real-time
              <span className="ml-2 px-2 py-0.5 rounded-full bg-[rgb(var(--accent-primary))]/10 text-[rgb(var(--accent-primary))] text-xs font-medium">
                {tokenCount} {tokenCount === 1 ? 'token' : 'tokens'}
              </span>
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onRefresh}
            disabled={isRefreshing}
            className="p-2.5 rounded-xl bg-[rgb(var(--bg-tertiary))] border border-[rgb(var(--border-primary))] text-[rgb(var(--text-secondary))] hover:text-[rgb(var(--accent-primary))] hover:border-[rgb(var(--accent-primary))]/30 transition-all duration-200 disabled:opacity-50"
            title="Refresh prices"
          >
            <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
          </motion.button>
          
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onAddToken}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[rgb(var(--accent-primary))] to-[rgb(var(--accent-secondary))] text-white font-semibold shadow-lg shadow-[rgb(var(--accent-primary))]/20 hover:shadow-xl hover:shadow-[rgb(var(--accent-primary))]/30 transition-all duration-300"
          >
            <Plus className="w-5 h-5" />
            <span>Add Token</span>
          </motion.button>
        </div>
      </div>

      {/* Search Bar */}
      <motion.div
        animate={{
          scale: isSearchFocused ? 1.01 : 1,
          boxShadow: isSearchFocused
            ? '0 0 0 2px rgb(var(--accent-primary) / 0.3), 0 8px 32px rgba(0, 0, 0, 0.1)'
            : '0 2px 8px rgba(0, 0, 0, 0.05)',
        }}
        className="relative max-w-md"
      >
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[rgb(var(--text-muted))]" />
        <input
          type="text"
          placeholder="Search tokens..."
          value={searchQuery}
          onChange={(e) => onSearch(e.target.value)}
          onFocus={() => setIsSearchFocused(true)}
          onBlur={() => setIsSearchFocused(false)}
          className="w-full pl-12 pr-4 py-3 rounded-xl bg-[rgb(var(--bg-tertiary))] border border-[rgb(var(--border-primary))] text-[rgb(var(--text-primary))] placeholder:text-[rgb(var(--text-muted))] focus:outline-none transition-all duration-200"
        />
        {searchQuery && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={() => onSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg hover:bg-[rgb(var(--border-primary))] text-[rgb(var(--text-muted))] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </motion.button>
        )}
      </motion.div>
    </motion.div>
  );
}
