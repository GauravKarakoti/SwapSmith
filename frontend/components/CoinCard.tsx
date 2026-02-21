'use client'

import { TrendingUp, Network, Zap, ArrowUpRight } from 'lucide-react';
import { motion } from 'framer-motion';

export interface CoinCardProps {
  coin: string;
  name: string;
  network: string;
  usdPrice?: string;
  available: boolean;
}

export default function CoinCard({ coin, name, network, usdPrice, available }: CoinCardProps) {
  // Parsing price for conditional styling
  const priceValue = usdPrice ? parseFloat(usdPrice) : 0;

  return (
    <motion.div
      whileHover={{ y: -5 }}
      className="glow-card group rounded-[2.5rem] p-6 border-primary transition-all duration-500 flex flex-col h-full"
    >
      {/* Header: Identity & Status */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-accent-primary to-accent-tertiary flex items-center justify-center text-primary font-black text-xl shadow-lg shadow-blue-500/20">
              {coin.slice(0, 2).toUpperCase()}
            </div>
            {available && (
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 border-4 border-white dark:border-zinc-900 rounded-full animate-pulse" />
            )}
          </div>
          <div className="min-w-0">
            <h3 className="font-black text-xl text-primary tracking-tighter truncate">
              {coin.toUpperCase()}
            </h3>
            <p className="text-xs font-bold text-muted uppercase tracking-widest truncate max-w-[120px]">
              {name}
            </p>
          </div>
        </div>
        
        {available ? (
          <div className="badge px-3 py-1 rounded-full flex items-center gap-1.5 animate-in fade-in zoom-in duration-500">
            <Zap className="w-3 h-3 fill-current" />
            <span className="text-[10px] font-black uppercase tracking-tighter">Live</span>
          </div>
        ) : (
          <div className="px-3 py-1 bg-zinc-100 dark:bg-zinc-800 text-muted rounded-full text-[10px] font-black uppercase tracking-tighter">
            Offline
          </div>
        )}
      </div>

      {/* Analytics Section */}
      <div className="space-y-4 flex-1">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2 text-secondary">
            <Network className="w-4 h-4 text-accent-primary" />
            <span className="text-xs font-bold uppercase tracking-wide">{network}</span>
          </div>
          <ArrowUpRight className="w-4 h-4 text-muted group-hover:text-accent-primary transition-colors" />
        </div>

        <div className="p-4 bg-section rounded-2xl border border-primary transition-colors group-hover:bg-section-hover">
          <div className="flex items-center gap-2 text-[10px] font-black text-muted uppercase tracking-widest mb-1">
            <TrendingUp className="w-3 h-3" />
            Market Value
          </div>
          {usdPrice ? (
            <div className="text-2xl font-black text-primary tracking-tighter">
              <span className="text-sm text-muted mr-1">$</span>
              {priceValue.toLocaleString(undefined, { 
                minimumFractionDigits: 2,
                maximumFractionDigits: 6 
              })}
            </div>
          ) : (
            <div className="text-sm font-bold text-error italic py-1">
              Data feed disconnected
            </div>
          )}
        </div>
      </div>

      {/* Action Area */}
      <div className="mt-6">
        <button 
          className="btn-primary w-full py-3.5 rounded-2xl flex items-center justify-center gap-2 text-sm font-black uppercase tracking-widest disabled:opacity-30 disabled:grayscale transition-all"
          disabled={!available}
        >
          {available ? (
            <>
              Trade Asset
              <Zap className="w-4 h-4 fill-white" />
            </>
          ) : (
            'Unavailable'
          )}
        </button>
      </div>
    </motion.div>
  );
}