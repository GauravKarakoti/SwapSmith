'use client'

import { useState } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { motion } from 'framer-motion';

interface PricePoint {
  time: string;
  price: number;
}

interface CryptoChartProps {
  title: string;
  symbol: string;
  currentPrice: string;
  change24h: number;
  data: PricePoint[];
}

export default function CryptoChart({ title, symbol, currentPrice, change24h, data }: CryptoChartProps) {
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);
  const isPositive = change24h > 0;

  // Generate SVG path from data points
  const generatePath = () => {
    if (data.length === 0) return '';
    
    const width = 100;
    const height = 100;
    const padding = 5;
    
    const prices = data.map(d => d.price);
    const max = Math.max(...prices);
    const min = Math.min(...prices);
    const range = max - min || 1;

    const points = data.map((point, i) => {
      const x = padding + (i / (data.length - 1)) * (width - padding * 2);
      const y = padding + (1 - (point.price - min) / range) * (height - padding * 2);
      return `${x},${y}`;
    });

    return `M ${points.join(' L ')}`;
  };

  // Generate area fill path
  const generateAreaPath = () => {
    if (data.length === 0) return '';
    
    const linePath = generatePath();
    const height = 100;
    
    return `${linePath} L ${95},${height - 5} L 5,${height - 5} Z`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
      className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-6 border border-slate-700 shadow-xl hover:shadow-2xl transition-shadow duration-300"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-lg font-bold text-white">{title}</h3>
            <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs font-semibold rounded">
              {symbol}
            </span>
          </div>
          <p className="text-sm text-gray-400">Last 100 days</p>
        </div>
        
        <div className="text-right">
          <div className="text-2xl font-bold text-white mb-1">
            ${parseFloat(currentPrice).toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 6
            })}
          </div>
          <div className={`flex items-center gap-1 justify-end ${
            isPositive ? 'text-green-400' : 'text-red-400'
          }`}>
            {isPositive ? (
              <TrendingUp className="w-4 h-4" />
            ) : (
              <TrendingDown className="w-4 h-4" />
            )}
            <span className="text-sm font-semibold">
              {isPositive ? '+' : ''}{change24h.toFixed(2)}%
            </span>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="relative h-48 bg-slate-900/50 rounded-lg p-4 border border-slate-700/50">
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="w-full h-full"
          onMouseLeave={() => setHoveredPoint(null)}
        >
          {/* Area fill with gradient */}
          <defs>
            <linearGradient id={`gradient-${symbol}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={isPositive ? '#10b981' : '#ef4444'} stopOpacity="0.3" />
              <stop offset="100%" stopColor={isPositive ? '#10b981' : '#ef4444'} stopOpacity="0.05" />
            </linearGradient>
          </defs>
          
          {/* Area */}
          <path
            d={generateAreaPath()}
            fill={`url(#gradient-${symbol})`}
          />
          
          {/* Line */}
          <path
            d={generatePath()}
            fill="none"
            stroke={isPositive ? '#10b981' : '#ef4444'}
            strokeWidth="0.5"
            vectorEffect="non-scaling-stroke"
          />
          
          {/* Data points (optional - show on hover) */}
          {hoveredPoint !== null && data[hoveredPoint] && (
            <circle
              cx={5 + (hoveredPoint / (data.length - 1)) * 90}
              cy={5 + (1 - (data[hoveredPoint].price - Math.min(...data.map(d => d.price))) / 
                (Math.max(...data.map(d => d.price)) - Math.min(...data.map(d => d.price)) || 1)) * 90}
              r="1"
              fill="white"
              stroke={isPositive ? '#10b981' : '#ef4444'}
              strokeWidth="0.5"
            />
          )}
        </svg>
        
        {/* Hover overlay for interaction */}
        <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${data.length}, 1fr)` }}>
          {data.map((_, i) => (
            <div
              key={i}
              className="cursor-crosshair"
              onMouseEnter={() => setHoveredPoint(i)}
            />
          ))}
        </div>
      </div>

      {/* Chart footer with time labels */}
      <div className="flex justify-between text-xs text-gray-500 mt-3 px-2">
        <span>{data[0]?.time || '0d'}</span>
        <span>{data[Math.floor(data.length / 2)]?.time || '50d'}</span>
        <span>{data[data.length - 1]?.time || '100d'}</span>
      </div>
    </motion.div>
  );
}
