'use client'

import { useMemo } from 'react';
import CryptoChart from './CryptoChart';
import { motion } from 'framer-motion';

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

// Generate mock price history data for the chart
const generatePriceHistory = (currentPrice: number, volatility: number = 0.1) => {
  const points = [];
  const days = 100;
  let price = currentPrice * 0.8; // Start at 80% of current price
  
  for (let i = 0; i < days; i++) {
    // Random walk with trend towards current price
    const trend = (currentPrice - price) * 0.01;
    const randomChange = (Math.random() - 0.5) * volatility * price;
    price = Math.max(price + trend + randomChange, currentPrice * 0.3);
    
    points.push({
      time: i === 0 ? '0d' : i === Math.floor(days / 2) ? '50d' : i === days - 1 ? '100d' : `${i}d`,
      price: price
    });
  }
  
  // Ensure last point is close to current price
  points[points.length - 1].price = currentPrice;
  
  return points;
};

export default function TopCryptoSection({ coins }: TopCryptoSectionProps) {
  // Get top 2 coins for featured charts
  const topTwoCoins = useMemo(() => {
    return coins.slice(0, 2);
  }, [coins]);

  if (topTwoCoins.length === 0) {
    return null;
  }

  return (
    <div className="mb-8">
      {/* Two Charts Side by Side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {topTwoCoins.map((coin, index) => {
          const currentPrice = parseFloat(coin.usdPrice);
          const priceHistory = generatePriceHistory(currentPrice, 0.15);
          const change = coin.change24h ?? 0;

          return (
            <motion.div
              key={`${coin.coin}-${coin.network}-${index}`}
              whileHover={{ scale: 1.03, boxShadow: '0 4px 24px #38bdf8' }}
              transition={{ type: 'spring', stiffness: 120, damping: 12 }}
            >
              <CryptoChart
                title={coin.name}
                symbol={coin.coin.toUpperCase()}
                currentPrice={coin.usdPrice}
                change24h={change}
                data={priceHistory}
              />
            </motion.div>
          );
        })}
        
        {/* If only one coin, show placeholder for second chart */}
        {topTwoCoins.length === 1 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-6 border border-slate-700 shadow-xl flex items-center justify-center"
          >
            <div className="text-center text-gray-500">
              <p className="text-lg font-semibold mb-2">More Charts Coming Soon</p>
              <p className="text-sm">Loading additional cryptocurrency data...</p>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
