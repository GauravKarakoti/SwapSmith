'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { WatchlistItem } from './types';
import WatchlistCard from './WatchlistCard';

interface WatchlistGridProps {
  items: WatchlistItem[];
  onRemove: (id: string) => void;
  onSwap: (symbol: string, network: string) => void;
  loading?: boolean;
}

// Skeleton loader for cards
const CardSkeleton = ({ index }: { index: number }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4, delay: index * 0.05 }}
    className="rounded-2xl border border-[rgb(var(--border-primary))] bg-[rgb(var(--bg-tertiary))] p-5"
  >
    {/* Header skeleton */}
    <div className="flex items-start justify-between mb-4">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-[rgb(var(--border-primary))] animate-pulse" />
        <div className="space-y-2">
          <div className="h-5 w-16 bg-[rgb(var(--border-primary))] rounded animate-pulse" />
          <div className="h-4 w-24 bg-[rgb(var(--border-primary))] rounded animate-pulse" />
        </div>
      </div>
    </div>
    
    {/* Sparkline skeleton */}
    <div className="mb-4 h-12 bg-[rgb(var(--border-primary))] rounded animate-pulse" />
    
    {/* Price skeleton */}
    <div className="mb-4 space-y-2">
      <div className="h-8 w-32 bg-[rgb(var(--border-primary))] rounded animate-pulse" />
    </div>
    
    {/* Stats skeleton */}
    <div className="flex items-center gap-4 mb-4">
      <div className="h-10 w-20 bg-[rgb(var(--border-primary))] rounded animate-pulse" />
      <div className="h-10 w-20 bg-[rgb(var(--border-primary))] rounded animate-pulse" />
    </div>
    
    {/* Button skeleton */}
    <div className="h-11 w-full bg-[rgb(var(--border-primary))] rounded-xl animate-pulse" />
  </motion.div>
);

export default function WatchlistGrid({ items, onRemove, onSwap, loading = false }: WatchlistGridProps) {
  // Show skeleton loaders while loading
  if (loading) {
    return (
      <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <CardSkeleton key={index} index={index} />
        ))}
      </div>
    );
  }

  // Empty state is handled by the parent component
  if (items.length === 0) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
    >
      <AnimatePresence mode="popLayout">
        {items.map((item, index) => (
          <WatchlistCard
            key={item.id}
            item={item}
            onRemove={onRemove}
            onSwap={onSwap}
            index={index}
          />
        ))}
      </AnimatePresence>
    </motion.div>
  );
}
