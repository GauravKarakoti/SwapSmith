'use client';

import { motion } from 'framer-motion';
import { Trash2, ArrowRightLeft, TrendingUp, TrendingDown } from 'lucide-react';
import { WatchlistItem } from './types';

interface WatchlistCardProps {
  item: WatchlistItem;
  onRemove: (id: string) => void;
  onSwap: (symbol: string, network: string) => void;
  index: number;
}

// Generate a simple sparkline path
const generateSparklinePath = (data: number[], width: number, height: number): string => {
  if (!data || data.length === 0) return '';
  
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  
  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * width;
    const y = height - ((value - min) / range) * height;
    return `${x},${y}`;
  });
  
  return `M ${points.join(' L ')}`;
};

// Format price with appropriate precision
const formatPrice = (price: number): string => {
  if (price >= 1000) {
    return price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  } else if (price >= 1) {
    return price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  } else {
    return price.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 6 });
  }
};

// Format market cap
const formatMarketCap = (value: number | undefined): string => {
  if (!value) return 'N/A';
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  return `$${value.toLocaleString()}`;
};

export default function WatchlistCard({ item, onRemove, onSwap, index }: WatchlistCardProps) {
  const isPositive = item.change24h >= 0;
  const changeColor = isPositive ? 'text-green-400' : 'text-red-400';
  const changeBg = isPositive ? 'bg-green-400/10' : 'bg-red-400/10';
  const TrendIcon = isPositive ? TrendingUp : TrendingDown;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      transition={{
        duration: 0.4,
        delay: index * 0.05,
        ease: [0.22, 1, 0.36, 1],
      }}
      whileHover={{ y: -4, scale: 1.01 }}
      className="group relative rounded-2xl border border-[rgb(var(--border-primary))] bg-[rgb(var(--bg-tertiary))] p-5 hover:shadow-xl hover:shadow-[rgb(var(--accent-primary))]/5 transition-all duration-300 overflow-hidden"
    >
      {/* Gradient overlay on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-[rgb(var(--accent-primary))]/5 via-transparent to-[rgb(var(--accent-tertiary))]/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
      
      {/* Card Content */}
      <div className="relative z-10">
        {/* Header: Token Info */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            {/* Token Icon */}
            <div className="relative">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[rgb(var(--accent-primary))] to-[rgb(var(--accent-tertiary))] flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-[rgb(var(--accent-primary))]/20">
                {item.symbol.slice(0, 2).toUpperCase()}
              </div>
              {/* Network badge */}
              <div className="absolute -bottom-1 -right-1 px-1.5 py-0.5 rounded-md bg-[rgb(var(--bg-secondary))] border border-[rgb(var(--border-primary))] text-[10px] font-medium text-[rgb(var(--text-muted))] capitalize">
                {item.network}
              </div>
            </div>
            
            {/* Token Name & Symbol */}
            <div>
              <h3 className="font-bold text-[rgb(var(--text-primary))] text-lg">
                {item.symbol.toUpperCase()}
              </h3>
              <p className="text-sm text-[rgb(var(--text-secondary))] truncate max-w-[120px]">
                {item.name}
              </p>
            </div>
          </div>
          
          {/* Remove Button */}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => onRemove(item.id)}
            className="p-2 rounded-lg text-[rgb(var(--text-muted))] hover:text-red-400 hover:bg-red-400/10 transition-all duration-200 opacity-0 group-hover:opacity-100"
            title="Remove from watchlist"
          >
            <Trash2 className="w-4 h-4" />
          </motion.button>
        </div>

        {/* Sparkline Chart */}
        {item.sparklineData && item.sparklineData.length > 0 && (
          <div className="mb-4 h-12 relative">
            <svg
              viewBox="0 0 100 40"
              className="w-full h-full"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id={`gradient-${item.id}`} x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop
                    offset="0%"
                    stopColor={isPositive ? 'rgb(34, 197, 94)' : 'rgb(239, 68, 68)'}
                    stopOpacity="0.3"
                  />
                  <stop
                    offset="100%"
                    stopColor={isPositive ? 'rgb(34, 197, 94)' : 'rgb(239, 68, 68)'}
                    stopOpacity="0"
                  />
                </linearGradient>
              </defs>
              <path
                d={generateSparklinePath(item.sparklineData, 100, 40)}
                fill="none"
                stroke={isPositive ? 'rgb(34, 197, 94)' : 'rgb(239, 68, 68)'}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        )}

        {/* Price Section */}
        <div className="mb-4">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-[rgb(var(--text-primary))]">
              ${formatPrice(item.price)}
            </span>
            <motion.span
              initial={{ scale: 1 }}
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 0.3 }}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-sm font-semibold ${changeColor} ${changeBg}`}
            >
              <TrendIcon className="w-3 h-3" />
              {isPositive ? '+' : ''}{item.change24h.toFixed(2)}%
            </motion.span>
          </div>
        </div>

        {/* Stats Row */}
        <div className="flex items-center gap-4 mb-4 text-sm">
          <div>
            <span className="text-[rgb(var(--text-muted))]">Market Cap</span>
            <p className="font-medium text-[rgb(var(--text-secondary))]">
              {formatMarketCap(item.marketCap)}
            </p>
          </div>
          <div className="w-px h-8 bg-[rgb(var(--border-primary))]" />
          <div>
            <span className="text-[rgb(var(--text-muted))]">24h Volume</span>
            <p className="font-medium text-[rgb(var(--text-secondary))]">
              {formatMarketCap(item.volume24h)}
            </p>
          </div>
        </div>

        {/* Action Button */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onSwap(item.symbol, item.network)}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[rgb(var(--accent-primary))] to-[rgb(var(--accent-secondary))] text-white font-semibold shadow-lg shadow-[rgb(var(--accent-primary))]/20 hover:shadow-xl hover:shadow-[rgb(var(--accent-primary))]/30 transition-all duration-300"
        >
          <ArrowRightLeft className="w-4 h-4" />
          <span>Swap</span>
        </motion.button>

        {/* Added Date */}
        <p className="text-xs text-[rgb(var(--text-muted))] mt-3 text-center">
          Added {new Date(item.addedAt).toLocaleDateString()}
        </p>
      </div>
    </motion.div>
  );
}
