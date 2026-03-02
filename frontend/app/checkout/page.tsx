'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Crown,
  Zap,
  Star,
  Check,
  ArrowLeft,
  Sparkles,
  Shield,
  MessageSquare,
  Terminal,
  Clock,
  AlertCircle,
  Loader2,
  TrendingUp,
} from 'lucide-react'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import { useAuth } from '@/hooks/useAuth'
import { usePlan } from '@/hooks/usePlan'
import { PLAN_CONFIGS } from '../../../shared/config/plans'
import type { Plan } from '../../../shared/config/plans'

/* -------------------------------------------------------------------------- */
/* Helpers & constants                                                          */
/* -------------------------------------------------------------------------- */

const PLAN_ICONS: Record<string, React.ElementType> = {
  free: Zap,
  premium: TrendingUp,
  pro: Crown,
}

const PLAN_GRADIENTS: Record<string, string> = {
  free: 'from-gray-900/80 via-gray-800/60 to-gray-900/80',
  premium: 'from-blue-950/80 via-blue-900/50 to-indigo-950/80',
  pro: 'from-purple-950/80 via-violet-900/50 to-purple-950/80',
}

const PLAN_BORDER: Record<string, string> = {
  free: 'border-gray-700/50',
  premium: 'border-blue-500/40',
  pro: 'border-purple-500/40',
}

const PLAN_BADGE_STYLE: Record<string, string> = {
  premium: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  pro: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
}

const PLAN_BUTTON_STYLE: Record<string, string> = {
  premium: 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-blue-600/30',
  pro: 'bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 shadow-purple-600/30',
}

/* -------------------------------------------------------------------------- */
/* Plan Card Component                                                          */
/* -------------------------------------------------------------------------- */

interface PlanCardProps {
  planKey: Plan
  currentPlan: Plan
  userCoins: number
  onPurchase: (plan: 'premium' | 'pro') => void
  purchasing: boolean
}

function PlanCard({ planKey, currentPlan, userCoins, onPurchase, purchasing }: PlanCardProps) {
  const config = PLAN_CONFIGS[planKey]
  const PlanIcon = PLAN_ICONS[planKey]
  const isCurrentPlan = currentPlan === planKey
  const isFree = planKey === 'free'
  const canAfford = userCoins >= config.coinsCost
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: planKey === 'free' ? 0 : planKey === 'premium' ? 0.1 : 0.2 }}
      className={`relative rounded-2xl border backdrop-blur-xl overflow-hidden ${PLAN_BORDER[planKey]} bg-gradient-to-br ${PLAN_GRADIENTS[planKey]}`}
    >
      {/* Popular / Best Value badge */}
      {config.badge && (
        <div className={`absolute top-4 right-4 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full border ${PLAN_BADGE_STYLE[planKey]}`}>
          {config.badge}
        </div>
      )}

      <div className="p-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${
            planKey === 'free' ? 'bg-gray-700/60' :
            planKey === 'premium' ? 'bg-blue-500/20 border border-blue-500/30' :
            'bg-purple-500/20 border border-purple-500/30'
          }`}>
            <PlanIcon className={`w-5 h-5 ${config.color}`} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">{config.displayName}</h3>
            <p className="text-xs text-gray-400">{config.description}</p>
          </div>
        </div>

        {/* Price */}
        <div className="mb-5">
          {isFree ? (
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-black text-white">Free</span>
              <span className="text-sm text-gray-400">forever</span>
            </div>
          ) : (
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-white">{config.coinsCost.toLocaleString()}</span>
              <span className="text-sm font-semibold text-gray-400">coins</span>
              <span className="text-xs text-gray-500">/ {config.durationDays} days</span>
            </div>
          )}
        </div>

        {/* Limits highlight */}
        {!isFree && (
          <div className="flex gap-3 mb-5">
            <div className={`flex-1 rounded-xl p-3 text-center ${planKey === 'premium' ? 'bg-blue-500/10 border border-blue-500/20' : 'bg-purple-500/10 border border-purple-500/20'}`}>
              <MessageSquare className={`w-4 h-4 mx-auto mb-1 ${config.color}`} />
              <div className="text-sm font-bold text-white">
                {config.dailyChatLimit === -1 ? '∞' : config.dailyChatLimit}
              </div>
              <div className="text-[10px] text-gray-400">chats/day</div>
            </div>
            <div className={`flex-1 rounded-xl p-3 text-center ${planKey === 'premium' ? 'bg-blue-500/10 border border-blue-500/20' : 'bg-purple-500/10 border border-purple-500/20'}`}>
              <Terminal className={`w-4 h-4 mx-auto mb-1 ${config.color}`} />
              <div className="text-sm font-bold text-white">
                {config.dailyTerminalLimit === -1 ? '∞' : config.dailyTerminalLimit}
              </div>
              <div className="text-[10px] text-gray-400">terminal/day</div>
            </div>
          </div>
        )}

        {/* Features */}
        <ul className="space-y-2.5 mb-6">
          {config.features.map((feature) => (
            <li key={feature} className="flex items-start gap-2.5">
              <Check className={`w-4 h-4 mt-0.5 shrink-0 ${isFree ? 'text-gray-400' : config.color}`} />
              <span className="text-sm text-gray-300">{feature}</span>
            </li>
          ))}
        </ul>

        {/* CTA */}
        {isFree ? (
          <div className="w-full py-3 rounded-xl border border-gray-600/50 text-gray-400 text-sm font-semibold text-center cursor-default">
            {isCurrentPlan ? 'Current Plan' : 'Free Forever'}
          </div>
        ) : isCurrentPlan ? (
          <div className="w-full py-3 rounded-xl bg-green-500/10 border border-green-500/30 text-green-400 text-sm font-semibold text-center flex items-center justify-center gap-2">
            <Check className="w-4 h-4" />
            Active Plan
          </div>
        ) : (
          <button
            onClick={() => onPurchase(planKey as 'premium' | 'pro')}
            disabled={purchasing || !canAfford}
            className={`w-full py-3 rounded-xl text-sm font-bold text-white transition-all shadow-lg active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed ${PLAN_BUTTON_STYLE[planKey]}`}
          >
            {purchasing ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Processing…
              </span>
            ) : !canAfford ? (
              <span className="flex items-center justify-center gap-2">
                <AlertCircle className="w-4 h-4" />
                Need {(config.coinsCost - userCoins).toLocaleString()} more coins
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <Sparkles className="w-4 h-4" />
                Activate {config.displayName}
              </span>
            )}
          </button>
        )}

        {!isFree && !canAfford && (
          <Link
            href="/rewards"
            className="mt-2 w-full py-2 rounded-xl border border-gray-600/40 text-gray-400 text-xs font-semibold text-center hover:border-gray-500/60 hover:text-gray-300 transition-all flex items-center justify-center gap-1.5"
          >
            <Star className="w-3.5 h-3.5" />
            Earn Coins via Rewards
          </Link>
        )}
      </div>
    </motion.div>
  )
}

/* -------------------------------------------------------------------------- */
/* Main Checkout Page                                                           */
/* -------------------------------------------------------------------------- */

export default function CheckoutPage() {
  const router = useRouter()
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const { status, loading, purchasing, purchasePlan } = usePlan()
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [purchaseError, setPurchaseError] = useState<string | null>(null)

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login?redirect=/checkout')
    }
  }, [authLoading, isAuthenticated, router])

  const handlePurchase = async (plan: 'premium' | 'pro') => {
    setPurchaseError(null)
    setSuccessMessage(null)
    const result = await purchasePlan(plan)
    if (result.success) {
      setSuccessMessage(result.message)
    } else {
      setPurchaseError(result.message)
    }
  }

  if (authLoading || loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0a0a0f]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-500 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Loading…</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) return null

  const currentPlan = (status?.plan ?? 'free') as Plan
  const userCoins = status?.totalPoints ?? 0

  return (
    <>
      <Navbar />

      {/* Ambient backgrounds */}
      <div className="fixed inset-0 z-[-1] overflow-hidden pointer-events-none">
        <div className="absolute top-[-15%] left-[-10%] w-[45%] h-[45%] rounded-full bg-purple-600/10 blur-[140px]" />
        <div className="absolute bottom-[-15%] right-[-10%] w-[45%] h-[45%] rounded-full bg-blue-600/10 blur-[140px]" />
        <div className="absolute top-[50%] left-[50%] -translate-x-1/2 -translate-y-1/2 w-[30%] h-[30%] rounded-full bg-indigo-600/8 blur-[120px]" />
      </div>

      <div className="min-h-screen bg-[#0a0a0f] text-white pt-20 sm:pt-24 pb-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="mb-10"
          >
            <button
              onClick={() => router.back()}
              className="group flex items-center gap-2 text-sm text-gray-500 hover:text-gray-300 mb-6 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              Back
            </button>

            <div className="text-center">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-purple-500/30 bg-purple-500/10 text-purple-300 text-xs font-semibold mb-4">
                <Crown className="w-3.5 h-3.5" />
                Plan Upgrade
              </div>
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white mb-3">
                Upgrade Your Plan
              </h1>
              <p className="text-gray-400 max-w-xl mx-auto text-sm leading-relaxed">
                Use your SwapSmith coins earned from completing courses, daily logins, and swaps to unlock more power.
              </p>
            </div>
          </motion.div>

          {/* Coin Balance Card */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.05 }}
            className="mb-8 max-w-md mx-auto"
          >
            <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-950/50 via-orange-950/30 to-amber-900/20 backdrop-blur-xl p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20 border border-amber-500/30">
                    <Star className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                    <p className="text-xs text-amber-400/70 font-medium uppercase tracking-wider">Your Balance</p>
                    <p className="text-2xl font-black text-amber-300">{userCoins.toLocaleString()}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">SwapSmith Coins</p>
                  <Link href="/rewards" className="text-xs text-amber-400 hover:text-amber-300 font-semibold transition-colors flex items-center gap-1 justify-end mt-1">
                    <Zap className="w-3 h-3" />
                    Earn more
                  </Link>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Current Plan Usage */}
          {status && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="mb-8 max-w-md mx-auto"
            >
              <div className="rounded-2xl border border-gray-700/50 bg-gray-900/50 backdrop-blur-xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Clock className="w-4 h-4 text-gray-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Today&apos;s Usage</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <MessageSquare className="w-3 h-3" /> Chat
                      </span>
                      <span className="text-xs font-semibold text-gray-300">
                        {status.dailyChatCount}/{status.dailyChatLimit === -1 ? '∞' : status.dailyChatLimit}
                      </span>
                    </div>
                    <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          status.chatLimitExceeded ? 'bg-red-500' : 'bg-blue-500'
                        }`}
                        style={{
                          width: status.dailyChatLimit === -1
                            ? '20%'
                            : `${Math.min((status.dailyChatCount / status.dailyChatLimit) * 100, 100)}%`
                        }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <Terminal className="w-3 h-3" /> Terminal
                      </span>
                      <span className="text-xs font-semibold text-gray-300">
                        {status.dailyTerminalCount}/{status.dailyTerminalLimit === -1 ? '∞' : status.dailyTerminalLimit}
                      </span>
                    </div>
                    <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          status.terminalLimitExceeded ? 'bg-red-500' : 'bg-purple-500'
                        }`}
                        style={{
                          width: status.dailyTerminalLimit === -1
                            ? '20%'
                            : `${Math.min((status.dailyTerminalCount / status.dailyTerminalLimit) * 100, 100)}%`
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Success / Error messages */}
          <AnimatePresence>
            {successMessage && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mb-6 max-w-md mx-auto p-4 rounded-2xl bg-green-500/10 border border-green-500/30 text-green-400 text-sm flex items-center gap-3"
              >
                <Check className="w-5 h-5 shrink-0" />
                {successMessage}
              </motion.div>
            )}
            {purchaseError && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mb-6 max-w-md mx-auto p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-center gap-3"
              >
                <AlertCircle className="w-5 h-5 shrink-0" />
                {purchaseError}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Plan Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            {(['free', 'premium', 'pro'] as Plan[]).map((planKey) => (
              <PlanCard
                key={planKey}
                planKey={planKey}
                currentPlan={currentPlan}
                userCoins={userCoins}
                onPurchase={handlePurchase}
                purchasing={purchasing}
              />
            ))}
          </div>

          {/* How it works */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.35 }}
            className="rounded-2xl border border-gray-700/50 bg-gray-900/40 backdrop-blur-xl p-6 mb-8"
          >
            <h2 className="text-base font-bold text-white mb-5 flex items-center gap-2">
              <Shield className="w-4 h-4 text-blue-400" />
              How Plan Purchases Work
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                {
                  step: '01',
                  title: 'Earn Coins',
                  desc: 'Complete courses, log in daily, connect your wallet, and make swaps to earn SwapSmith coins.',
                  color: 'text-amber-400',
                },
                {
                  step: '02',
                  title: 'Purchase Plan',
                  desc: 'Spend your coins to activate a Premium or Pro plan for 30 days. No credit card needed.',
                  color: 'text-blue-400',
                },
                {
                  step: '03',
                  title: 'Enjoy Benefits',
                  desc: 'Access higher daily limits, ad-free experience, and priority features immediately.',
                  color: 'text-purple-400',
                },
              ].map(({ step, title, desc, color }) => (
                <div key={step} className="flex flex-col gap-2">
                  <span className={`text-3xl font-black ${color} opacity-40`}>{step}</span>
                  <h3 className="text-sm font-bold text-white">{title}</h3>
                  <p className="text-xs text-gray-400 leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </motion.div>

          {/* FAQ */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="rounded-2xl border border-gray-700/50 bg-gray-900/40 backdrop-blur-xl p-6"
          >
            <h2 className="text-base font-bold text-white mb-5">Frequently Asked Questions</h2>
            <div className="space-y-4">
              {[
                {
                  q: 'When do daily limits reset?',
                  a: 'Daily usage counters reset at midnight UTC every day, regardless of when you last used the feature.',
                },
                {
                  q: 'Can I extend my plan?',
                  a: 'Yes! Purchasing the same plan while it\'s active will extend it by another 30 days.',
                },
                {
                  q: 'What happens when my plan expires?',
                  a: 'Your account automatically reverts to the Free plan with standard limits. Your data is never lost.',
                },
                {
                  q: 'Are coins refundable?',
                  a: 'Coin purchases are final. Make sure you have enough coins before upgrading.',
                },
              ].map(({ q, a }) => (
                <div key={q} className="border-b border-gray-800/60 pb-4 last:border-0 last:pb-0">
                  <p className="text-sm font-semibold text-gray-200 mb-1">{q}</p>
                  <p className="text-xs text-gray-400 leading-relaxed">{a}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </>
  )
}
