'use client'

import { useState, useCallback, useEffect } from 'react'
import { Eye, EyeOff, User, Mail, Lock, Check, AlertCircle, Loader2, ShieldCheck, ArrowRight } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import AuroraBackground from '@/components/AuroraBackground'

/* ------------------------------------------------------------------ */
/* Data (same as login for consistent branding)                          */
/* ------------------------------------------------------------------ */
const PLANS = [
  {
    name: 'Free',
    price: '0',
    period: 'coins · forever',
    gradient: 'linear-gradient(135deg, #052212 0%, #061a10 100%)',
    border: '1px solid rgba(52,211,153,0.22)',
    accent: '#34d399',
    icon: '',
    features: ['20 AI chats / day', '5 terminal commands / day', 'Real-time prices', '50+ chains'],
    cta: '/register',
    ctaLabel: 'Get Started',
    ctaStyle: { background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.28)', color: '#34d399' },
  },
  {
    name: 'Premium',
    price: '500',
    period: 'coins · 30 days',
    gradient: 'linear-gradient(135deg, #050d2a 0%, #080d22 100%)',
    border: '1px solid rgba(96,165,250,0.35)',
    accent: '#60a5fa',
    icon: '',
    features: ['200 AI chats / day', '50 terminal commands / day', 'Ad-free experience', 'All Free features'],
    cta: '/checkout',
    ctaLabel: 'Activate Premium',
    ctaStyle: { background: '#2563eb', border: 'none', color: '#fff' },
    popular: true,
  },
  {
    name: 'Pro',
    price: '1,500',
    period: 'coins · 30 days',
    gradient: 'linear-gradient(135deg, #0f0520 0%, #0a0318 100%)',
    border: '1px solid rgba(167,139,250,0.28)',
    accent: '#a78bfa',
    icon: '',
    features: ['Unlimited AI chats', 'Unlimited terminal', 'Ad-free experience', 'Priority access'],
    cta: '/checkout',
    ctaLabel: 'Activate Pro',
    ctaStyle: { background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.28)', color: '#a78bfa' },
  },
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

  // Carousel state for plan cards
  const [carouselIdx, setCarouselIdx] = useState(1) // start on Premium
  const carouselNext = useCallback(() => setCarouselIdx((p) => (p + 1) % PLANS.length), [])
  useEffect(() => { const t = setInterval(carouselNext, 4000); return () => clearInterval(t) }, [carouselNext])

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
            <div className="flex items-center justify-center w-9 h-9 rounded-xl overflow-hidden">
              <Image src="/swapsmithicon.png" alt="SwapSmith" width={36} height={36} />
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
            <div className="animate-element animate-delay-700 pt-1 flex justify-center">
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

          {/* Admin Portal */}
          <Link
            href="/admin/login"
            className="animate-element animate-delay-900 block w-full text-center rounded-2xl py-3 text-xs font-medium transition-all duration-200"
            style={{ border: '1px solid rgba(124,58,237,0.2)', color: '#6b7280' }}
          >
            <ShieldCheck className="w-3 h-3 inline mr-1.5" style={{ color: '#a78bfa' }} />
            Admin Portal
          </Link>

          {/* Footer note */}
          <p className="animate-element animate-delay-900 flex items-center justify-center gap-1.5 text-center text-xs" style={{ color: '#374151' }}>
            <ShieldCheck className="w-3 h-3" />
            Non-custodial  Your keys, your assets
          </p>
        </div>
      </section>

      {/* RIGHT — plans carousel */}
      <section className="animate-slide-right animate-delay-300 hidden md:flex flex-1 relative overflow-hidden flex-col">

        {/* Aurora shader background (renders its own deep-black background) */}
        <AuroraBackground />

        {/* Dot grid overlay */}
        <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 2, opacity: 0.025, backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.9) 1px, transparent 1px)', backgroundSize: '28px 28px' }} />

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="relative px-10 xl:px-14 pt-6 pb-5" style={{ zIndex: 3, borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
          <div className="animate-element animate-delay-400 inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-3 text-[10px] font-black uppercase tracking-[0.18em]" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', color: '#6b7280' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            SwapSmith Plans
          </div>
          <h2 className="animate-element animate-delay-500 text-3xl xl:text-4xl font-black tracking-tighter leading-[1.08] mb-2" style={{ color: '#f1f5f9' }}>
            Upgrade your{' '}
            <span style={{ background: 'linear-gradient(90deg, #60a5fa, #a78bfa, #818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              trading stack.
            </span>
          </h2>
          <p className="animate-element animate-delay-600 text-xs leading-relaxed" style={{ color: '#4b5563', maxWidth: '300px' }}>
            AI-powered routing, yield scouting, Telegram swaps &amp; multi-chain support.
          </p>
        </div>

        {/* 3D Carousel */}
        <div className="relative flex-1 flex items-center justify-center" style={{ zIndex: 3, minHeight: 0, padding: '20px 0 44px' }}>
          <div className="relative w-full h-full flex items-center justify-center" style={{ perspective: '1200px' }}>
            {PLANS.map((plan, index) => {
              const total = PLANS.length
              let pos = (index - carouselIdx + total) % total
              if (pos > Math.floor(total / 2)) pos -= total
              const isCenter   = pos === 0
              const isAdjacent = Math.abs(pos) === 1
              return (
                <div
                  key={plan.name}
                  className="absolute flex flex-col rounded-3xl overflow-hidden"
                  style={{
                    width: '280px',
                    height: '430px',
                    padding: '24px',
                    background: plan.gradient,
                    border: isCenter ? '1px solid rgba(255,255,255,0.13)' : '1px solid rgba(255,255,255,0.04)',
                    transform: `translateX(${pos * 58}%) scale(${isCenter ? 1 : isAdjacent ? 0.8 : 0.6}) rotateY(${pos * -14}deg)`,
                    zIndex: isCenter ? 10 : isAdjacent ? 5 : 1,
                    opacity: isCenter ? 1 : isAdjacent ? 0.5 : 0,
                    filter: isCenter ? 'none' : 'blur(4px)',
                    visibility: Math.abs(pos) > 1 ? 'hidden' : 'visible',
                    transition: 'all 0.6s cubic-bezier(0.22,1,0.36,1)',
                  }}
                >
                  {plan.popular && (
                    <div className="absolute top-0 right-0 rounded-bl-xl rounded-tr-3xl px-3 py-1.5 text-[9px] font-black uppercase tracking-widest" style={{ background: '#2563eb', color: '#fff' }}>
                      Popular
                    </div>
                  )}
                  <div className="mb-5">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg mb-4 text-[11px] font-black uppercase tracking-wider" style={{ background: `${plan.accent}18`, color: plan.accent }}>
                      {plan.name}
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-black leading-none" style={{ color: '#f1f5f9' }}>{plan.price}</span>
                      <span className="text-sm" style={{ color: '#6b7280' }}>{plan.period}</span>
                    </div>
                  </div>
                  <ul className="flex flex-col gap-3 flex-1 mb-6">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5 text-[13px] leading-snug" style={{ color: '#9ca3af' }}>
                        <Check className="w-4 h-4 shrink-0 mt-px" style={{ color: plan.accent }} />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={plan.cta}
                    className="block text-center text-sm font-bold py-3 rounded-xl transition-all duration-200 hover:opacity-90"
                    style={plan.ctaStyle}
                  >
                    {plan.ctaLabel}
                  </Link>
                </div>
              )
            })}
          </div>

          {/* Dots */}
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex gap-2 z-20">
            {PLANS.map((_, i) => (
              <button
                key={i}
                onClick={() => setCarouselIdx(i)}
                className="rounded-full transition-all duration-300"
                style={{
                  width: i === carouselIdx ? '22px' : '6px',
                  height: '6px',
                  background: i === carouselIdx ? PLANS[i].accent : 'rgba(255,255,255,0.18)',
                }}
              />
            ))}
          </div>
        </div>

      </section>
    </div>
  )
}
