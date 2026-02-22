'use client'

import { useState, useEffect, useCallback } from 'react'
import { X, Zap, TrendingUp, Bot, Link2, Star, Sparkles } from 'lucide-react'

/* ------------------------------------------------------------------ */
/* Ad definitions                                                        */
/* ------------------------------------------------------------------ */

export type AdVariant = 'plan-free' | 'plan-pro' | 'plan-premium' | 'bot' | 'yields' | 'payment-links' | 'swaps'

interface Ad {
  id: AdVariant
  badge: string
  badgeColor: string
  headline: string
  subline: string
  cta: string
  href: string
  icon: React.ReactNode
  gradient: string
  accentColor: string
  progressColor: string
}

const ADS: Ad[] = [
  {
    id: 'plan-free',
    badge: 'FREE PLAN',
    badgeColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    headline: 'Start swapping for free',
    subline: 'Basic swaps, real-time prices, and unlimited asset support — no credit card required.',
    cta: 'Get started →',
    href: '/register',
    icon: <Zap className="w-5 h-5" />,
    gradient: 'from-emerald-900/40 to-teal-900/20',
    accentColor: 'text-emerald-400',
    progressColor: 'bg-emerald-400',
  },
  {
    id: 'plan-pro',
    badge: 'PRO PLAN',
    badgeColor: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    headline: 'Upgrade to Pro',
    subline: 'Advanced analytics, swap history exports, priority execution and dedicated support.',
    cta: 'View Pro →',
    href: '/rewards',
    icon: <TrendingUp className="w-5 h-5" />,
    gradient: 'from-blue-900/40 to-indigo-900/20',
    accentColor: 'text-blue-400',
    progressColor: 'bg-blue-400',
  },
  {
    id: 'plan-premium',
    badge: '✦ PREMIUM',
    badgeColor: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    headline: 'Go Premium — unlock everything',
    subline: 'AI-powered swap routing, early access features, and real-time yield alerts.',
    cta: 'Explore Premium →',
    href: '/rewards',
    icon: <Sparkles className="w-5 h-5" />,
    gradient: 'from-purple-900/40 to-pink-900/20',
    accentColor: 'text-purple-400',
    progressColor: 'bg-purple-400',
  },
  {
    id: 'bot',
    badge: 'TELEGRAM BOT',
    badgeColor: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
    headline: 'Swap on the go',
    subline: 'The SwapSmith Telegram Bot lets you execute swaps and get live prices without opening a browser.',
    cta: 'Open Bot →',
    href: 'https://t.me/SwapSmithBot',
    icon: <Bot className="w-5 h-5" />,
    gradient: 'from-cyan-900/40 to-sky-900/20',
    accentColor: 'text-cyan-400',
    progressColor: 'bg-cyan-400',
  },
  {
    id: 'yields',
    badge: 'YIELD SCOUT',
    badgeColor: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    headline: 'Find the best yields',
    subline: 'Scout top DeFi protocols for the highest APY on your assets — updated in real-time.',
    cta: 'Scout Yields →',
    href: '/yield-scout',
    icon: <Star className="w-5 h-5" />,
    gradient: 'from-yellow-900/40 to-amber-900/20',
    accentColor: 'text-yellow-400',
    progressColor: 'bg-yellow-400',
  },
  {
    id: 'payment-links',
    badge: 'PAYMENT LINKS',
    badgeColor: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
    headline: 'Request crypto in seconds',
    subline: 'Generate shareable payment links for any asset on any chain — no wallet connection needed to pay.',
    cta: 'Create a Link →',
    href: '/terminal',
    icon: <Link2 className="w-5 h-5" />,
    gradient: 'from-pink-900/40 to-rose-900/20',
    accentColor: 'text-pink-400',
    progressColor: 'bg-pink-400',
  },
  {
    id: 'swaps',
    badge: 'SWAPSMITH',
    badgeColor: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
    headline: 'Cross-chain swaps, done right',
    subline: 'Swap any asset across 50+ chains with best-rate routing — powered by AI intent parsing.',
    cta: 'Start Swapping →',
    href: '/terminal',
    icon: <Zap className="w-5 h-5" fill="currentColor" />,
    gradient: 'from-indigo-900/40 to-violet-900/20',
    accentColor: 'text-indigo-400',
    progressColor: 'bg-indigo-400',
  },
]

/* ------------------------------------------------------------------ */
/* Random / cooldown logic                                               */
/* ------------------------------------------------------------------ */

/**
 * Decide whether to show an ad and which one to show.
 * Each page passes its own storageKey so cooldowns are independent.
 *
 * @param forceShow   – bypass probability check (cooldown still applies unless cleared externally)
 * @param probability – 0–1 chance of showing when cooldown has elapsed
 * @param storageKey  – unique key per page context (default: 'swapsmith_ad_global')
 * @param cooldownMs  – minimum ms between impressions (default: 5 minutes)
 */
export function pickAd(
  forceShow = false,
  probability = 0.75,
  storageKey = 'swapsmith_ad_global',
  cooldownMs = 5 * 60 * 1000,
): Ad | null {
  const now = Date.now()
  const lastShown = Number(localStorage.getItem(storageKey) ?? 0)
  const lastId = localStorage.getItem(`${storageKey}_id`) as AdVariant | null

  // Respect per-page cooldown
  if (now - lastShown < cooldownMs) return null

  // Random probability gate (unless forced)
  if (!forceShow && Math.random() > probability) return null

  // Pick a random ad, avoiding repeating the last one shown
  const eligible = lastId ? ADS.filter((a) => a.id !== lastId) : ADS
  const ad = eligible[Math.floor(Math.random() * eligible.length)]

  return ad ?? null
}

/** Mark an ad as shown so the cooldown timer starts for this page context */
export function markAdShown(adId: AdVariant, storageKey = 'swapsmith_ad_global') {
  localStorage.setItem(storageKey, String(Date.now()))
  localStorage.setItem(`${storageKey}_id`, adId)
}

/* ------------------------------------------------------------------ */
/* Component                                                             */
/* ------------------------------------------------------------------ */

interface AdsContainerProps {
  /** Duration in ms before auto-dismiss. Default: 3000 */
  duration?: number
  /** Called when the ad is dismissed (auto or manual) */
  onDismiss?: () => void
  /** Specific ad to show; if omitted, one will be randomly selected */
  ad?: Ad
  /** Position of the floating card */
  position?: 'bottom-right' | 'bottom-left' | 'bottom-center'
}

export default function AdsContainer({
  duration = 3000,
  onDismiss,
  ad,
  position = 'bottom-right',
}: AdsContainerProps) {
  const [visible, setVisible] = useState(true)
  const [progress, setProgress] = useState(100)
  const [resolvedAd] = useState<Ad | null>(() => ad ?? null)

  const dismiss = useCallback(() => {
    setVisible(false)
    onDismiss?.()
  }, [onDismiss])

  /* Progress bar countdown */
  useEffect(() => {
    if (!visible) return
    const start = Date.now()
    const tick = () => {
      const elapsed = Date.now() - start
      const remaining = Math.max(0, 1 - elapsed / duration)
      setProgress(remaining * 100)
      if (remaining <= 0) {
        dismiss()
      } else {
        raf = requestAnimationFrame(tick)
      }
    }
    let raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [visible, duration, dismiss])

  if (!visible || !resolvedAd) return null

  const positionClasses = {
    'bottom-right': 'bottom-6 right-6',
    'bottom-left': 'bottom-6 left-6',
    'bottom-center': 'bottom-6 left-1/2 -translate-x-1/2',
  }[position]

  const currentAd = resolvedAd

  return (
    <div
      className={`fixed ${positionClasses} z-[9999] w-80 max-w-[calc(100vw-3rem)] animate-in fade-in slide-in-from-bottom-4 duration-300`}
      role="complementary"
      aria-label="Advertisement"
    >
      <div
        className={`relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br ${currentAd.gradient} backdrop-blur-xl shadow-2xl`}
      >
        {/* Close button */}
        <button
          onClick={dismiss}
          aria-label="Dismiss ad"
          className="absolute top-3 right-3 p-1 rounded-lg text-white/40 hover:text-white/80 hover:bg-white/10 transition-colors z-10"
        >
          <X className="w-3.5 h-3.5" />
        </button>

        {/* Ad label */}
        <div className="absolute top-3 left-3 text-[9px] font-bold uppercase tracking-widest text-white/25 select-none">
          Ad
        </div>

        {/* Body */}
        <div className="px-4 pt-8 pb-4">
          {/* Badge */}
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${currentAd.badgeColor} mb-3`}
          >
            <span className={currentAd.accentColor}>{currentAd.icon}</span>
            {currentAd.badge}
          </span>

          {/* Headline */}
          <h3 className="text-white font-bold text-sm leading-snug mb-1">
            {currentAd.headline}
          </h3>

          {/* Subline */}
          <p className="text-white/50 text-xs leading-relaxed mb-4">
            {currentAd.subline}
          </p>

          {/* CTA */}
          <a
            href={currentAd.href}
            className={`inline-flex items-center text-xs font-bold ${currentAd.accentColor} hover:brightness-125 transition-all`}
            onClick={dismiss}
            target={currentAd.href.startsWith('http') ? '_blank' : undefined}
            rel={currentAd.href.startsWith('http') ? 'noopener noreferrer' : undefined}
          >
            {currentAd.cta}
          </a>
        </div>

        {/* Progress bar */}
        <div className="h-0.5 bg-white/10">
          <div
            className={`h-full ${currentAd.progressColor} transition-none`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  )
}
