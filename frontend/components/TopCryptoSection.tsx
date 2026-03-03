'use client'

import { useMemo } from 'react';
import CryptoChart from './CryptoChart';
import { motion } from 'framer-motion';
import { Activity, Sparkles } from 'lucide-react';

export interface TopCoin {
  coin: string;
  name: string;
  network: string;
  usdPrice: string;
  change24h?: number;
  marketCap?: string;
  volume24h?: string;
}

interface TopCryptoSectionProps {
  coins: TopCoin[];
}

// Logic preserved: Mock price history generator
const generatePriceHistory = (currentPrice: number, volatility: number = 0.1) => {
  const points = [];
  const days = 100;
  let price = currentPrice * 0.8; 
  
  for (let i = 0; i < days; i++) {
    const trend = (currentPrice - price) * 0.01;
    const randomChange = (Math.random() - 0.5) * volatility * price;
    price = Math.max(price + trend + randomChange, currentPrice * 0.3);
    
    points.push({
      time: i === 0 ? '0d' : i === Math.floor(days / 2) ? '50d' : i === days - 1 ? '100d' : `${i}d`,
      price: price
    });
  }
  points[points.length - 1].price = currentPrice;
  return points;
};

export default function TopCryptoSection({ coins }: TopCryptoSectionProps) {
  // Logic preserved: Get top 2 coins
  const topTwoCoins = useMemo(() => {
    return coins.slice(0, 2);
  }, [coins]);

  if (topTwoCoins.length === 0) return null;

  return (
    <div className="mb-12 relative">
      {/* Section Sub-header */}
      <div className="flex items-center gap-2 mb-6 px-2">
        <Sparkles className="w-4 h-4 text-accent-tertiary" />
        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-muted">
          High-Velocity Assets
        </span>
      </div>

      {/* Featured Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {topTwoCoins.map((coin, index) => {
          const currentPrice = parseFloat(coin.usdPrice);
          const priceHistory = generatePriceHistory(currentPrice, 0.15);
          const change = coin.change24h ?? 0;

          return (
            <motion.div
              key={`${coin.coin}-${coin.network}-${index}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ y: -5 }}
              className="relative group"
            >
              {/* Decorative Glow behind the chart */}
              <div className="absolute -inset-1 bg-gradient-to-r from-accent-primary to-accent-tertiary rounded-[2.5rem] blur opacity-10 group-hover:opacity-20 transition duration-500" />
              
              <div className="relative glass rounded-[2.5rem] border-primary overflow-hidden shadow-2xl">
                <CryptoChart
                  title={coin.name}
                  symbol={coin.coin.toUpperCase()}
                  currentPrice={coin.usdPrice}
                  change24h={change}
                  data={priceHistory}
                />
              </div>
            </motion.div>
          );
        })}
        
        {/* Placeholder State - Theme Aware */}
        {topTwoCoins.length === 1 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-[2.5rem] border-2 border-dashed border-primary bg-secondary/30 flex flex-col items-center justify-center p-12 text-center"
          >
            <div className="w-16 h-16 rounded-3xl bg-primary flex items-center justify-center mb-4 shadow-inner">
              <Activity className="w-8 h-8 text-muted animate-pulse" />
            </div>
            <p className="text-lg font-black tracking-tighter text-primary">
              Expanding Index
            </p>
            <p className="text-sm text-muted font-medium mt-1">
              Synchronizing additional market nodes...
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
}