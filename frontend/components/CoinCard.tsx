'use client'

import { TrendingUp, Network } from 'lucide-react';
import { motion } from 'framer-motion';

export interface CoinCardProps {
  coin: string;
  name: string;
  network: string;
  usdPrice?: string;
  available: boolean;
}

export default function CoinCard({ coin, name, network, usdPrice, available }: CoinCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300 p-4 border border-gray-200 dark:border-gray-700"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg">
            {coin.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <h3 className="font-semibold text-lg text-gray-900 dark:text-white">
              {coin.toUpperCase()}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">{name}</p>
          </div>
        </div>
        {available && (
          <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 rounded-full">
            Active
          </span>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          <Network className="w-4 h-4" />
          <span className="capitalize">{network}</span>
        </div>

        {usdPrice && (
          <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
              <TrendingUp className="w-4 h-4" />
              <span className="text-sm font-medium">USD Price</span>
            </div>
            <span className="text-lg font-bold text-gray-900 dark:text-white">
              ${parseFloat(usdPrice).toLocaleString(undefined, { 
                minimumFractionDigits: 2,
                maximumFractionDigits: 6 
              })}
            </span>
          </div>
        )}

        {!available && (
          <div className="text-sm text-red-600 dark:text-red-400 italic">
            Price unavailable
          </div>
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
        <button 
          className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors duration-200 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={!available}
        >
          Trade {coin.toUpperCase()}
        </button>
      </div>
    </motion.div>
  );
}
