'use client'

import { useState, useEffect, useCallback } from 'react'
import { X, Check, Zap, TrendingUp, Sparkles, Bot, Star, Link2, Wallet, BookOpen, Gift } from 'lucide-react'
import Link from 'next/link'

/* ------------------------------------------------------------------ */
/* Data                                                                  */
/* ------------------------------------------------------------------ */

const PLANS = [
  {
    name: 'Free',
    tagline: 'Perfect for crypto explorers',
    price: '0',
    period: 'coins · forever',
    Icon: Zap,
    iconBg: '#dcfce7',
    iconColor: '#16a34a',
    features: ['20 AI chats / day', '5 terminal commands / day', 'Real-time prices', '50+ chains'],
    cta: '/register',
    ctaLabel: 'Get Started',
    popular: false,
  },
  {
    name: 'Premium',
    tagline: 'For active DeFi users',
    price: '500',
    period: 'coins / 30 days',
    Icon: TrendingUp,
    iconBg: '#fef3c7',
    iconColor: '#d97706',
    features: ['200 AI chats / day', '50 terminal commands / day', 'Ad-free experience', 'All Free features'],
    cta: '/checkout',
    ctaLabel: 'Activate Premium',
    popular: true,
  },
  {
    name: 'Pro',
    tagline: 'For power users & whales',
    price: '1,500',
    period: 'coins / 30 days',
    Icon: Sparkles,
    iconBg: '#ede9fe',
    iconColor: '#7c3aed',
    features: ['Unlimited AI chats', 'Unlimited terminal', 'Ad-free experience', 'Priority access'],
    cta: '/checkout',
    ctaLabel: 'Activate Pro',
    popular: false,
  },
]

const PROMO_CARDS = [
  {
    Icon: Wallet,
    iconBg: '#dbeafe',
    iconColor: '#1d4ed8',
    name: 'Connect Wallet',
    tagline: 'Connect your wallet in seconds',
    statNum: '8+',
    statLabel: 'wallets supported',
    cards: ['MetaMask & injected', 'WalletConnect v2', 'Hardware wallets', 'One-click connect'],
    cta: '/terminal',
    ctaLabel: 'Connect Now',
    popular: false,
  },
  {
    Icon: BookOpen,
    iconBg: '#dcfce7',
    iconColor: '#15803d',
    name: 'Learning Hub',
    tagline: 'Master DeFi with SwapSmith Learn',
    statNum: 'Free',
    statLabel: 'forever',
    cards: ['Beginner DeFi guides', 'Swap strategy playbooks', 'Yield farming basics', 'Live quizzes & badges'],
    cta: '/learn',
    ctaLabel: 'Start Learning',
    popular: true,
  },
  {
    Icon: Gift,
    iconBg: '#fce7f3',
    iconColor: '#be185d',
    name: 'Rewards',
    tagline: 'Earn SwapSmith tokens daily',
    statNum: 'Daily',
    statLabel: 'token drops',
    cards: ['Login streak rewards', 'Swap-to-earn bonuses', 'Referral payouts', 'Airdrop eligibility'],
    cta: '/rewards',
    ctaLabel: 'Claim Rewards',
    popular: false,
  },
]

const SITE_FEATURES = [
  {
    Icon: Bot,
    iconBg: '#cffafe',
    iconColor: '#0891b2',
    name: 'Telegram Bot',
    tagline: 'Swap without leaving Telegram',
    statNum: 'Free',
    statLabel: 'to use',
    cards: ['Live swap quotes', 'Cross-chain support', 'Portfolio tracking', 'One-click execution'],
    cta: 'https://t.me/SwapSmithBot',
    ctaLabel: 'Open Bot',
    popular: true,
  },
  {
    Icon: Star,
    iconBg: '#fef9c3',
    iconColor: '#ca8a04',
    name: 'Yield Scout',
    tagline: 'Scout the highest DeFi yields',
    statNum: '50+',
    statLabel: 'protocols',
    cards: ['Real-time APY scan', 'Multi-chain support', 'Auto yield alerts', 'Risk-ranked results'],
    cta: '/yield-scout',
    ctaLabel: 'Scout Now',
    popular: false,
  },
  {
    Icon: Link2,
    iconBg: '#fce7f3',
    iconColor: '#be185d',
    name: 'Payment Links',
    tagline: 'Request any crypto in seconds',
    statNum: 'Any',
    statLabel: 'token or chain',
    cards: ['Shareable link', 'No wallet needed', 'Any token/chain', 'Instant settlement'],
    cta: '/terminal',
    ctaLabel: 'Create Link',
    popular: false,
  },
]

/* ------------------------------------------------------------------ */
/* Types                                                                 */
/* ------------------------------------------------------------------ */

export type FullPageAdVariant = 'plans' | 'features' | 'promo'

interface FullPageAdProps {
  variant?: FullPageAdVariant
  /** ms before auto-dismiss. 0 disables auto-dismiss. Default: 12000 */
  duration?: number
  onDismiss?: () => void
}

/* ------------------------------------------------------------------ */
/* Component                                                             */
/* ------------------------------------------------------------------ */

export default function FullPageAd({
  variant = 'plans',
  duration = 12000,
  onDismiss,
}: FullPageAdProps) {
  const [visible, setVisible] = useState(true)
  const [countdown, setCountdown] = useState(duration > 0 ? Math.ceil(duration / 1000) : 0)
  const [progress, setProgress] = useState(100)

  const dismiss = useCallback(() => {
    setVisible(false)
    onDismiss?.()
  }, [onDismiss])

  useEffect(() => {
    if (!visible || duration <= 0) return
    const start = Date.now()
    let raf: number
    const tick = () => {
      const elapsed = Date.now() - start
      const remaining = Math.max(0, 1 - elapsed / duration)
      setProgress(remaining * 100)
      setCountdown(Math.ceil((remaining * duration) / 1000))
      if (remaining <= 0) { dismiss() } else { raf = requestAnimationFrame(tick) }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [visible, duration, dismiss])

  if (!visible) return null

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.80)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }}
    >
      <div className="relative w-full max-w-5xl bg-white rounded-2xl shadow-2xl overflow-hidden">

        {/* Dismiss */}
        <button
          onClick={dismiss}
          className="absolute top-4 right-4 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-gray-500 hover:bg-gray-100 transition-all"
          style={{ border: '1px solid #e5e7eb' }}
        >
          {duration > 0 && <span>{countdown}s</span>}
          <X className="w-3.5 h-3.5" />
        </button>

        {/* Ad label */}
        <div className="absolute top-4 left-4 text-[9px] font-bold uppercase tracking-widest text-gray-300">
          Sponsored
        </div>

        {/* PLANS VARIANT */}
        {variant === 'plans' && (
          <div className="px-8 pt-10 pb-8">
            <span className="absolute top-10 left-10 text-2xl select-none pointer-events-none"></span>
            <span className="absolute top-8 right-20 text-xl select-none pointer-events-none"></span>

            <div className="text-center mb-7">
              <p className="text-sm font-bold text-blue-500 mb-2 tracking-wide">Simple Pricing</p>
              <h2 className="text-3xl font-black text-gray-900 tracking-tight mb-2">
                Unlock <span className="text-blue-600">SwapSmith&apos;s</span> full potential
              </h2>
              <p className="text-sm text-gray-500">AI routing  Telegram swaps  yield scouting — pick your plan.</p>
            </div>

            <div className="grid grid-cols-3 gap-4 items-start">
              {PLANS.map((plan, i) => (
                <div
                  key={plan.name}
                  className={`ad-card-enter ad-card-hover relative flex flex-col rounded-2xl p-5 border ${plan.popular ? 'border-gray-800 shadow-xl' : 'border-gray-200'}`}
                  style={plan.popular ? { transform: 'translateY(-6px) scale(1.02)', animationDelay: `${i * 0.12}s` } : { animationDelay: `${i * 0.12}s` }}
                >
                  {plan.popular && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-black text-white whitespace-nowrap" style={{ background: '#f59e0b' }}>
                      Popular!
                    </div>
                  )}
                  <div className="w-11 h-11 rounded-full border-2 border-gray-200 flex items-center justify-center mb-3" style={{ background: plan.iconBg }}>
                    <plan.Icon className="w-5 h-5" style={{ color: plan.iconColor }} />
                  </div>
                  <h3 className="text-base font-black text-gray-900 mb-0.5">{plan.name}</h3>
                  <p className="text-[11px] text-gray-500 mb-3 leading-snug">{plan.tagline}</p>
                  <div className="flex items-baseline gap-1 mb-4">
                    <span className="text-3xl font-black text-gray-900">{plan.price}</span>
                    <span className="text-sm text-gray-400">{plan.period}</span>
                  </div>
                  <ul className="flex flex-col gap-2 flex-1 mb-5">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-center gap-2 text-xs text-gray-700 leading-snug">
                        <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '#dcfce7' }}>
                          <Check className="w-2.5 h-2.5 text-green-600" />
                        </div>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={plan.cta}
                    onClick={dismiss}
                    className="block text-center py-3 rounded-xl text-sm font-bold transition-all hover:opacity-90"
                    style={plan.popular ? { background: '#f59e0b', color: '#fff' } : { background: '#f8fafc', color: '#374151', border: '1px solid #e2e8f0' }}
                  >
                    {plan.ctaLabel}
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* FEATURES VARIANT */}
        {variant === 'features' && (
          <div className="px-8 pt-10 pb-8">
            <span className="absolute top-10 left-10 text-2xl select-none pointer-events-none"></span>
            <span className="absolute top-8 right-20 text-xl select-none pointer-events-none"></span>

            <div className="text-center mb-7">
              <p className="text-sm font-bold text-blue-500 mb-2 tracking-wide">Explore SwapSmith</p>
              <h2 className="text-3xl font-black text-gray-900 tracking-tight mb-2">
                Powerful tools, <span className="text-blue-600">built for DeFi</span>
              </h2>
              <p className="text-sm text-gray-500">Trade smarter with SwapSmith&apos;s suite of decentralised finance tools.</p>
            </div>

            <div className="grid grid-cols-3 gap-4 items-start">
              {SITE_FEATURES.map((feat, i) => (
                <div
                  key={feat.name}
                  className={`ad-card-enter ad-card-hover relative flex flex-col rounded-2xl p-5 border ${feat.popular ? 'border-gray-800 shadow-xl' : 'border-gray-200'}`}
                  style={feat.popular ? { transform: 'translateY(-6px) scale(1.02)', animationDelay: `${i * 0.12}s` } : { animationDelay: `${i * 0.12}s` }}
                >
                  {feat.popular && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-black text-white whitespace-nowrap" style={{ background: '#f59e0b' }}>
                      Popular!
                    </div>
                  )}
                  <div className="w-11 h-11 rounded-full border-2 border-gray-200 flex items-center justify-center mb-3" style={{ background: feat.iconBg }}>
                    <feat.Icon className="w-5 h-5" style={{ color: feat.iconColor }} />
                  </div>
                  <h3 className="text-base font-black text-gray-900 mb-0.5">{feat.name}</h3>
                  <p className="text-[11px] text-gray-500 mb-3 leading-snug">{feat.tagline}</p>
                  <div className="flex items-baseline gap-1 mb-4">
                    <span className="text-3xl font-black text-gray-900">{feat.statNum}</span>
                    <span className="text-sm text-gray-400">{feat.statLabel}</span>
                  </div>
                  <ul className="flex flex-col gap-2 flex-1 mb-5">
                    {feat.cards.map((c) => (
                      <li key={c} className="flex items-center gap-2 text-xs text-gray-700 leading-snug">
                        <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '#dcfce7' }}>
                          <Check className="w-2.5 h-2.5 text-green-600" />
                        </div>
                        {c}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={feat.cta}
                    onClick={dismiss}
                    target={feat.cta.startsWith('http') ? '_blank' : undefined}
                    rel={feat.cta.startsWith('http') ? 'noopener noreferrer' : undefined}
                    className="block text-center py-3 rounded-xl text-sm font-bold transition-all hover:opacity-90"
                    style={feat.popular ? { background: '#f59e0b', color: '#fff' } : { background: '#f8fafc', color: '#374151', border: '1px solid #e2e8f0' }}
                  >
                    {feat.ctaLabel}
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PROMO VARIANT */}
        {variant === 'promo' && (
          <div className="px-8 pt-10 pb-8">
            <span className="absolute top-10 left-10 text-2xl select-none pointer-events-none">🎁</span>
            <span className="absolute top-8 right-20 text-xl select-none pointer-events-none">✨</span>

            <div className="text-center mb-7">
              <p className="text-sm font-bold text-blue-500 mb-2 tracking-wide">Discover SwapSmith</p>
              <h2 className="text-3xl font-black text-gray-900 tracking-tight mb-2">
                More ways to <span className="text-blue-600">earn &amp; learn</span>
              </h2>
              <p className="text-sm text-gray-500">Connect your wallet, level up your DeFi knowledge, and earn rewards every day.</p>
            </div>

            <div className="grid grid-cols-3 gap-4 items-start">
              {PROMO_CARDS.map((card, i) => (
                <div
                  key={card.name}
                  className={`ad-card-enter ad-card-hover relative flex flex-col rounded-2xl p-5 border ${
                    card.popular ? 'border-gray-800 shadow-xl' : 'border-gray-200'
                  }`}
                  style={card.popular ? { transform: 'translateY(-6px) scale(1.02)', animationDelay: `${i * 0.12}s` } : { animationDelay: `${i * 0.12}s` }}
                >
                  {card.popular && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-black text-white whitespace-nowrap" style={{ background: '#f59e0b' }}>
                      Popular!
                    </div>
                  )}
                  <div className="w-11 h-11 rounded-full border-2 border-gray-200 flex items-center justify-center mb-3" style={{ background: card.iconBg }}>
                    <card.Icon className="w-5 h-5" style={{ color: card.iconColor }} />
                  </div>
                  <h3 className="text-base font-black text-gray-900 mb-0.5">{card.name}</h3>
                  <p className="text-[11px] text-gray-500 mb-3 leading-snug">{card.tagline}</p>
                  <div className="flex items-baseline gap-1 mb-4">
                    <span className="text-3xl font-black text-gray-900">{card.statNum}</span>
                    <span className="text-sm text-gray-400">{card.statLabel}</span>
                  </div>
                  <ul className="flex flex-col gap-2 flex-1 mb-5">
                    {card.cards.map((c) => (
                      <li key={c} className="flex items-center gap-2 text-xs text-gray-700 leading-snug">
                        <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '#dcfce7' }}>
                          <Check className="w-2.5 h-2.5 text-green-600" />
                        </div>
                        {c}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={card.cta}
                    onClick={dismiss}
                    className="block text-center py-3 rounded-xl text-sm font-bold transition-all hover:opacity-90"
                    style={card.popular
                      ? { background: '#f59e0b', color: '#fff' }
                      : { background: '#f8fafc', color: '#374151', border: '1px solid #e2e8f0' }
                    }
                  >
                    {card.ctaLabel}
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Progress bar */}
        {duration > 0 && (
          <div className="h-1 bg-gray-100">
            <div className="h-full bg-blue-500 transition-none" style={{ width: `${progress}%` }} />
          </div>
        )}
      </div>
    </div>
  )
}
