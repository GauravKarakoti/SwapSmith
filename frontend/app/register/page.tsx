'use client'

import { useState } from 'react'
import { Eye, EyeOff, Zap, User, Mail, Lock, Check, AlertCircle, Loader2, Bot, Star, Link2, ShieldCheck, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'

/* ------------------------------------------------------------------ */
/* Data (same as login for consistent branding)                          */
/* ------------------------------------------------------------------ */
const PLANS = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    gradient: 'linear-gradient(135deg, #052212 0%, #061a10 100%)',
    border: '1px solid rgba(52,211,153,0.22)',
    accent: '#34d399',
    icon: '',
    features: ['Unlimited swaps', 'Real-time prices', '50+ chains', 'AI chat terminal'],
    cta: '/register',
    ctaLabel: 'Get Started',
    ctaStyle: { background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.28)', color: '#34d399' },
  },
  {
    name: 'Pro',
    price: '$12',
    period: '/mo',
    gradient: 'linear-gradient(135deg, #050d2a 0%, #080d22 100%)',
    border: '1px solid rgba(96,165,250,0.35)',
    accent: '#60a5fa',
    icon: '',
    features: ['Everything in Free', 'Swap history export', 'Priority execution', 'Telegram bot access'],
    cta: '/rewards',
    ctaLabel: 'Upgrade to Pro',
    ctaStyle: { background: '#2563eb', border: 'none', color: '#fff' },
    popular: true,
  },
  {
    name: 'Premium',
    price: '$29',
    period: '/mo',
    gradient: 'linear-gradient(135deg, #0f0520 0%, #0a0318 100%)',
    border: '1px solid rgba(167,139,250,0.28)',
    accent: '#a78bfa',
    icon: '',
    features: ['Everything in Pro', 'AI swap routing', 'Live yield alerts', 'Early access features'],
    cta: '/rewards',
    ctaLabel: 'Unlock Premium',
    ctaStyle: { background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.28)', color: '#a78bfa' },
  },
]

const FEATURES = [
  { icon: Bot,         label: 'Telegram Bot',           desc: 'Swap without leaving Telegram', color: '#22d3ee' },
  { icon: Star,        label: 'Yield Scout',             desc: 'Best DeFi APY in real-time',    color: '#fbbf24' },
  { icon: Link2,       label: 'Payment Links',           desc: 'Request any crypto instantly',  color: '#f472b6' },
  { icon: ShieldCheck, label: 'Non-custodial Security',  desc: 'Your keys, always',             color: '#34d399' },
]

/* ------------------------------------------------------------------ */
/* Page                                                                  */
/* ------------------------------------------------------------------ */
export default function RegisterPage() {
  const [name, setName]         = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [error, setError]       = useState('')
  const { register, isLoading } = useAuth()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    if (!name.trim()) { setError('Please enter your full name.'); return }
    try {
      await register(email, password)
    } catch (err) {
      const m = String(err)
      if (m.includes('email-already-in-use')) {
        setError('This email is already registered. Try signing in.')
      } else if (m.includes('weak-password')) {
        setError('Password must be at least 6 characters.')
      } else {
        setError('Failed to create account. Please try again.')
      }
    }
  }

  return (
    <div className="flex h-[100dvh] w-[100dvw] overflow-hidden" style={{ background: '#070710', fontFamily: 'inherit' }}>

      {/*  */}
      {/* LEFT — registration form                                       */}
      {/*  */}
      <section
        className="relative flex flex-col justify-center z-10 w-full lg:w-[33%] xl:w-[30%]"
        style={{ borderRight: '1px solid rgba(255,255,255,0.07)', background: '#0b0b18', minWidth: '320px' }}
      >
        {/* Top glow */}
        <div className="pointer-events-none absolute top-0 left-0 right-0 h-72" style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(79,70,229,0.12) 0%, transparent 70%)' }} />

        <div className="flex flex-col gap-5 px-8 xl:px-12 py-12 w-full">

          {/* Logo */}
          <div className="animate-element animate-delay-100 flex items-center gap-2.5 mb-1">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl" style={{ background: 'rgba(96,165,250,0.12)', border: '1px solid rgba(96,165,250,0.22)' }}>
              <Zap className="w-4 h-4" style={{ color: '#60a5fa' }} fill="currentColor" />
            </div>
            <span className="font-bold text-base tracking-tight" style={{ color: '#fff' }}>SwapSmith</span>
          </div>

          {/* Heading */}
          <div>
            <h1 className="animate-element animate-delay-200 text-4xl font-semibold leading-tight tracking-tighter" style={{ color: '#f1f5f9' }}>
              Create account
            </h1>
            <p className="animate-element animate-delay-300 mt-2 text-sm leading-relaxed" style={{ color: '#6b7280' }}>
              Join SwapSmith and start swapping across 50+ chains.
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-3 rounded-xl px-4 py-3 text-sm" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form className="flex flex-col gap-3.5" onSubmit={handleSubmit}>

            {/* Full Name */}
            <div className="animate-element animate-delay-400 flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#4b5563' }}>
                Full Name
              </label>
              <div
                className="rounded-2xl transition-all duration-200"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#374151' }} />
                  <input
                    name="name"
                    type="text"
                    required
                    disabled={isLoading}
                    placeholder="Your full name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-transparent text-sm py-3.5 pl-11 pr-4 rounded-2xl focus:outline-none disabled:opacity-40"
                    style={{ color: '#f1f5f9' }}
                  />
                </div>
              </div>
            </div>

            {/* Email */}
            <div className="animate-element animate-delay-500 flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#4b5563' }}>
                Email Address
              </label>
              <div
                className="rounded-2xl transition-all duration-200"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#374151' }} />
                  <input
                    name="email"
                    type="email"
                    required
                    disabled={isLoading}
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-transparent text-sm py-3.5 pl-11 pr-4 rounded-2xl focus:outline-none disabled:opacity-40"
                    style={{ color: '#f1f5f9' }}
                  />
                </div>
              </div>
            </div>

            {/* Password */}
            <div className="animate-element animate-delay-600 flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#4b5563' }}>
                Password
              </label>
              <div
                className="rounded-2xl transition-all duration-200"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#374151' }} />
                  <input
                    name="password"
                    type={showPw ? 'text' : 'password'}
                    required
                    disabled={isLoading}
                    placeholder="At least 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-transparent text-sm py-3.5 pl-11 pr-12 rounded-2xl focus:outline-none disabled:opacity-40"
                    style={{ color: '#f1f5f9' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    className="absolute inset-y-0 right-3 flex items-center transition-colors"
                    style={{ color: '#4b5563' }}
                  >
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Submit */}
            <div className="animate-element animate-delay-700 pt-1">
              <button
                type="submit"
                disabled={isLoading}
                className="rounded-2xl py-4 font-bold flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.99] group disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: '#2563eb', color: '#fff', boxShadow: '0 8px 24px rgba(37,99,235,0.35)', width: '80%' }}
              >
                {isLoading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Creating account</>
                ) : (
                  <>Create Account <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" /></>
                )}
              </button>
            </div>
          </form>

          {/* Divider */}
          <div className="animate-element animate-delay-800 relative flex items-center justify-center">
            <div className="absolute inset-x-0 top-1/2 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
            <span className="relative px-4 text-xs font-semibold uppercase tracking-widest" style={{ background: '#0b0b18', color: '#374151' }}>or</span>
          </div>

          {/* Login link */}
          <Link
            href="/login"
            className="animate-element animate-delay-900 block w-full text-center rounded-2xl py-3.5 text-sm font-semibold transition-all duration-200"
            style={{ border: '1px solid rgba(255,255,255,0.08)', color: '#9ca3af' }}
          >
            Already have an account? Sign in 
          </Link>

          {/* Footer note */}
          <p className="animate-element animate-delay-900 flex items-center justify-center gap-1.5 text-center text-xs" style={{ color: '#374151' }}>
            <ShieldCheck className="w-3 h-3" />
            Non-custodial  Your keys, your assets
          </p>
        </div>
      </section>

      {/*  */}
      {/* RIGHT — plans showcase (identical to login)                   */}
      {/*  */}
      <section className="animate-slide-right animate-delay-300 hidden md:flex flex-1 relative overflow-y-auto overflow-x-hidden flex-col">

        {/* Background */}
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(145deg, #07071a 0%, #0a0a1e 40%, #080d22 70%, #090716 100%)' }} />
        {/* Ambient glows */}
        <div className="absolute pointer-events-none" style={{ top: '-10%', right: '-5%', width: '650px', height: '650px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(79,70,229,0.11) 0%, transparent 70%)' }} />
        <div className="absolute pointer-events-none" style={{ bottom: '-15%', left: '10%', width: '500px', height: '500px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(124,58,237,0.07) 0%, transparent 70%)' }} />
        {/* Dot grid */}
        <div className="absolute inset-0 pointer-events-none" style={{ opacity: 0.022, backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.9) 1px, transparent 1px)', backgroundSize: '28px 28px' }} />

        {/*  Partition 1: header  */}
        <div className="relative z-10 px-12 xl:px-16 pt-14 pb-10" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="animate-element animate-delay-400 inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-5 text-[10px] font-black uppercase tracking-[0.18em]" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', color: '#6b7280' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            SwapSmith Plans
          </div>
          <h2 className="animate-element animate-delay-500 text-4xl xl:text-5xl font-black tracking-tighter leading-[1.08] mb-3" style={{ color: '#f1f5f9' }}>
            Upgrade your<br />
            <span style={{ background: 'linear-gradient(90deg, #60a5fa, #a78bfa, #818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              trading stack.
            </span>
          </h2>
          <p className="animate-element animate-delay-600 text-sm leading-relaxed" style={{ color: '#4b5563', maxWidth: '380px' }}>
            AI-powered routing, yield scouting, Telegram swaps &amp; multi-chain support.
          </p>
        </div>

        {/*  Partition 2: plan cards  */}
        <div className="relative z-10 flex-1 flex flex-col justify-center px-12 xl:px-16 py-8" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="max-w-2xl w-full">
            <div className="animate-element animate-delay-700 grid grid-cols-3 gap-3">
              {PLANS.map((plan) => (
                <div
                  key={plan.name}
                  className="relative flex flex-col rounded-2xl p-4 overflow-hidden"
                  style={{ background: plan.gradient, border: plan.border }}
                >
                  {plan.popular && (
                    <div className="absolute top-0 right-0 rounded-bl-xl rounded-tr-2xl px-2.5 py-1 text-[9px] font-black uppercase tracking-widest" style={{ background: '#2563eb', color: '#fff' }}>
                      Popular
                    </div>
                  )}
                  <div className="mb-3">
                    <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg mb-2.5 text-[10px] font-black uppercase tracking-wider" style={{ background: `${plan.accent}18`, color: plan.accent }}>
                      <span>{plan.icon}</span>
                      <span>{plan.name}</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-black leading-none" style={{ color: '#f1f5f9' }}>{plan.price}</span>
                      <span className="text-xs" style={{ color: '#4b5563' }}>{plan.period}</span>
                    </div>
                  </div>
                  <ul className="flex flex-col gap-1.5 flex-1 mb-4">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-[11px] leading-snug" style={{ color: '#9ca3af' }}>
                        <Check className="w-3 h-3 shrink-0 mt-px" style={{ color: plan.accent }} />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={plan.cta}
                    className="block text-center text-xs font-bold py-2 rounded-xl transition-all duration-200"
                    style={plan.ctaStyle}
                  >
                    {plan.ctaLabel}
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/*  Partition 3: feature cards  */}
        <div className="relative z-10 px-12 xl:px-16 py-6">
          <div className="grid grid-cols-4 gap-2.5">
            {FEATURES.map((feat, i) => {
              const Icon = feat.icon
              const delays = ['animate-delay-1000', 'animate-delay-1200', 'animate-delay-1400', 'animate-delay-1400'] as const
              return (
                <div
                  key={feat.label}
                  className={`animate-testimonial ${delays[i]} flex flex-col gap-2.5 rounded-2xl p-3.5 transition-all duration-200`}
                  style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}
                >
                  <div className="flex items-center justify-center w-8 h-8 rounded-xl" style={{ background: `${feat.color}14`, color: feat.color }}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold leading-tight mb-0.5" style={{ color: '#f1f5f9' }}>{feat.label}</p>
                    <p className="text-[10px] leading-snug" style={{ color: '#4b5563' }}>{feat.desc}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>
    </div>
  )
}
