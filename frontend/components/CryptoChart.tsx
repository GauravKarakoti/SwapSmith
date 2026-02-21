'use client'

import { useState } from 'react';
import { TrendingUp, TrendingDown, Activity, Calendar } from 'lucide-react';
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
    const width = 100, height = 100, padding = 5;
    const prices = data.map(d => d.price);
    const max = Math.max(...prices), min = Math.min(...prices);
    const range = max - min || 1;

    const points = data.map((point, i) => {
      const x = padding + (i / (data.length - 1)) * (width - padding * 2);
      const y = padding + (1 - (point.price - min) / range) * (height - padding * 2);
      return `${x},${y}`;
    });
    return `M ${points.join(' L ')}`;
  };

  const generateAreaPath = () => {
    if (data.length === 0) return '';
    const linePath = generatePath();
    return `${linePath} L 95,95 L 5,95 Z`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -5 }}
      transition={{ duration: 0.5, type: 'spring' }}
      className="glow-card group rounded-[2.5rem] p-6 border-primary transition-all duration-500 shadow-xl"
    >
      {/* Header: Identity & Analytics */}
      <div className="flex items-start justify-between mb-8">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-secondary rounded-xl border border-primary">
              <Activity className={`w-5 h-5 ${isPositive ? 'text-emerald-500' : 'text-red-500'}`} />
            </div>
            <div>
              <h3 className="text-xl font-black text-primary tracking-tighter leading-tight">
                {title}
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-accent-primary">
                  {symbol}
                </span>
                <span className="w-1 h-1 rounded-full bg-muted" />
                <div className="flex items-center gap-1 text-[10px] font-bold text-muted uppercase tracking-widest">
                  <Calendar className="w-3 h-3" />
                  100D Window
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="text-right">
          <div className="text-2xl font-black text-primary tracking-tighter">
            <span className="text-xs text-muted mr-1 font-bold">$</span>
            {parseFloat(currentPrice).toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 6
            })}
          </div>
          <div className={`flex items-center gap-1.5 justify-end px-2 py-0.5 rounded-lg text-xs font-black uppercase tracking-tighter ${
            isPositive ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-red-500/10 text-red-600 dark:text-red-400'
          }`}>
            {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            <span>{isPositive ? '+' : ''}{change24h.toFixed(2)}%</span>
          </div>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="relative h-52 bg-section rounded-3xl p-6 border border-primary transition-all group-hover:bg-section-hover overflow-hidden shadow-inner">
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="w-full h-full overflow-visible"
          onMouseLeave={() => setHoveredPoint(null)}
        >
          <defs>
            <linearGradient id={`chart-grad-${symbol}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={isPositive ? '#10b981' : '#ef4444'} stopOpacity="0.4" />
              <stop offset="100%" stopColor={isPositive ? '#10b981' : '#ef4444'} stopOpacity="0" />
            </linearGradient>
            {/* Filter for line glow */}
            <filter id="glow">
              <feGaussianBlur stdDeviation="1.5" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          
          <path d={generateAreaPath()} fill={`url(#chart-grad-${symbol})`} className="transition-all duration-700" />
          
          <path
            d={generatePath()}
            fill="none"
            stroke={isPositive ? '#10b981' : '#ef4444'}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            filter="url(#glow)"
            className="transition-all duration-700"
          />
          
          {hoveredPoint !== null && data[hoveredPoint] && (
            <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <line 
                x1={5 + (hoveredPoint / (data.length - 1)) * 90} y1="0" 
                x2={5 + (hoveredPoint / (data.length - 1)) * 90} y2="100" 
                stroke="currentColor" className="text-muted/20" strokeWidth="0.5" strokeDasharray="2,2" 
              />
              <circle
                cx={5 + (hoveredPoint / (data.length - 1)) * 90}
                cy={5 + (1 - (data[hoveredPoint].price - Math.min(...data.map(d => d.price))) / 
                  (Math.max(...data.map(d => d.price)) - Math.min(...data.map(d => d.price)) || 1)) * 90}
                r="2"
                fill="white"
                className="shadow-xl"
                stroke={isPositive ? '#10b981' : '#ef4444'}
                strokeWidth="1"
              />
            </motion.g>
          )}
        </svg>
        
        {/* Interaction Layer */}
        <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${data.length}, 1fr)` }}>
          {data.map((_, i) => (
            <div key={i} className="cursor-crosshair h-full" onMouseEnter={() => setHoveredPoint(i)} />
          ))}
        </div>

        {/* Dynamic Tooltip on Hover */}
        {hoveredPoint !== null && (
          <div 
            className="absolute top-2 pointer-events-none bg-white dark:bg-zinc-800 border border-primary px-3 py-1 rounded-lg shadow-2xl text-[10px] font-black transition-all"
            style={{ 
                left: `${(hoveredPoint / (data.length - 1)) * 80 + 10}%`,
                transform: 'translateX(-50%)'
            }}
          >
            <div className="text-muted uppercase tracking-tighter">{data[hoveredPoint].time}</div>
            <div className="text-primary">${data[hoveredPoint].price.toFixed(2)}</div>
          </div>
        )}
      </div>

      {/* Axis Labels */}
      <div className="flex justify-between items-center mt-6 px-4">
        <div className="flex gap-4">
            <span className="text-[10px] font-bold text-muted uppercase tracking-widest">{data[0]?.time || 'Start'}</span>
        </div>
        <div className="h-px flex-1 bg-border-primary mx-8 opacity-20" />
        <span className="text-[10px] font-bold text-muted uppercase tracking-widest">{data[data.length - 1]?.time || 'Present'}</span>
      </div>
    </motion.div>
  );
}