'use client';

import { motion } from 'framer-motion';
import { Star, Plus, Sparkles } from 'lucide-react';

interface EmptyStateProps {
  onAddToken: () => void;
}

export default function EmptyState({ onAddToken }: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col items-center justify-center py-16 px-6"
    >
      {/* Animated Background */}
      <div className="relative">
        {/* Glow effect */}
        <div className="absolute inset-0 blur-3xl bg-gradient-to-r from-yellow-400/20 via-orange-500/20 to-pink-500/20 rounded-full scale-150" />
        
        {/* Icon container */}
        <motion.div
          animate={{
            y: [0, -10, 0],
            rotate: [0, 5, -5, 0],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="relative p-6 rounded-3xl bg-gradient-to-br from-yellow-400/10 to-orange-500/10 border border-yellow-500/20"
        >
          <Star className="w-16 h-16 text-yellow-400 fill-yellow-400" />
          
          {/* Sparkle decorations */}
          <motion.div
            animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity, delay: 0 }}
            className="absolute -top-2 -right-2"
          >
            <Sparkles className="w-5 h-5 text-yellow-300" />
          </motion.div>
          <motion.div
            animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
            className="absolute -bottom-1 -left-2"
          >
            <Sparkles className="w-4 h-4 text-orange-300" />
          </motion.div>
        </motion.div>
      </div>

      {/* Text Content */}
      <div className="mt-8 text-center max-w-md">
        <h3 className="text-2xl font-bold text-[rgb(var(--text-primary))] mb-3">
          No tokens in your watchlist
        </h3>
        <p className="text-[rgb(var(--text-secondary))] mb-6 leading-relaxed">
          Start building your personalized portfolio tracker by adding your favorite cryptocurrencies.
        </p>

        {/* Feature highlights */}
        <div className="flex flex-wrap justify-center gap-3 mb-8">
          {['Real-time prices', 'Price alerts', 'Quick swaps'].map((feature, index) => (
            <motion.span
              key={feature}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + index * 0.1 }}
              className="px-3 py-1.5 rounded-full bg-[rgb(var(--bg-tertiary))] border border-[rgb(var(--border-primary))] text-sm text-[rgb(var(--text-secondary))]"
            >
              {feature}
            </motion.span>
          ))}
        </div>

        {/* Add Token Button */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onAddToken}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[rgb(var(--accent-primary))] to-[rgb(var(--accent-secondary))] text-white font-semibold shadow-lg shadow-[rgb(var(--accent-primary))]/20 hover:shadow-xl hover:shadow-[rgb(var(--accent-primary))]/30 transition-all duration-300"
        >
          <Plus className="w-5 h-5" />
          <span>Add Your First Token</span>
        </motion.button>
      </div>

      {/* Decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 60, repeat: Infinity, ease: 'linear' }}
          className="absolute top-1/4 left-1/4 w-64 h-64 border border-[rgb(var(--border-primary))]/30 rounded-full"
        />
        <motion.div
          animate={{ rotate: -360 }}
          transition={{ duration: 80, repeat: Infinity, ease: 'linear' }}
          className="absolute bottom-1/4 right-1/4 w-96 h-96 border border-[rgb(var(--border-primary))]/20 rounded-full"
        />
      </div>
    </motion.div>
  );
}
