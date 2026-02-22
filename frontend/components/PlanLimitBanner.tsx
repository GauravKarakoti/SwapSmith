'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Zap, X, Crown, Star } from 'lucide-react'
import Link from 'next/link'
import type { Plan } from '../../shared/config/plans'

interface PlanLimitBannerProps {
  feature: 'chat' | 'terminal'
  currentPlan: Plan
  onDismiss?: () => void
  className?: string
}

const FEATURE_LABEL = {
  chat: 'chat messages',
  terminal: 'terminal executions',
}

export default function PlanLimitBanner({
  feature,
  currentPlan,
  onDismiss,
  className = '',
}: PlanLimitBannerProps) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 400, damping: 28 }}
        className={`relative rounded-2xl overflow-hidden border border-amber-500/30 bg-gradient-to-br from-amber-950/60 via-orange-950/40 to-amber-900/30 backdrop-blur-xl p-5 shadow-xl ${className}`}
      >
        {/* Glow effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-amber-500/5 via-orange-500/5 to-yellow-500/5 pointer-events-none" />

        {onDismiss && (
          <button
            onClick={onDismiss}
            className="absolute top-3 right-3 p-1.5 rounded-lg text-amber-400/60 hover:text-amber-300 hover:bg-white/5 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}

        <div className="relative z-10">
          <div className="flex items-start gap-3 mb-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 border border-amber-500/30">
              <Zap className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-amber-300">Daily limit reached</h3>
              <p className="text-xs text-amber-400/70 mt-0.5">
                You&apos;ve used all your {FEATURE_LABEL[feature]} for today on the{' '}
                <span className="font-semibold capitalize">{currentPlan}</span> plan.
              </p>
            </div>
          </div>

          <p className="text-xs text-amber-200/60 mb-4 leading-relaxed">
            Upgrade with SwapSmith coins earned from rewards to unlock more daily usage. Limits reset every day at midnight UTC.
          </p>

          <div className="flex flex-col sm:flex-row gap-2">
            <Link
              href="/checkout"
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black text-xs font-bold rounded-xl transition-all shadow-lg shadow-amber-500/25 active:scale-[0.98]"
            >
              <Crown className="w-3.5 h-3.5" />
              Upgrade Plan
            </Link>
            <Link
              href="/rewards"
              className="flex items-center justify-center gap-2 px-4 py-2.5 border border-amber-500/30 hover:bg-amber-500/10 text-amber-300 text-xs font-semibold rounded-xl transition-all active:scale-[0.98]"
            >
              <Star className="w-3.5 h-3.5" />
              Earn More Coins
            </Link>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
