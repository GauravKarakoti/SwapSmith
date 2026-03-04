'use client'

import { useState, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { auth } from '@/lib/firebase'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from 'firebase/auth'
import {
  Eye, EyeOff, Zap, Mail, Lock, User, AlertCircle, Loader2,
  ArrowRight, ShieldCheck, Check, BarChart2, Users, Shield,
} from 'lucide-react'
import AuroraBackground from '@/components/AuroraBackground'

const ADMIN_FEATURES = [
  {
    name: 'Analytics',
    gradient: 'linear-gradient(135deg, #050d2a 0%, #080d22 100%)',
    accent: '#60a5fa',
    Icon: BarChart2,
    features: ['Total swaps executed', 'Volume by day / week / month', 'Success vs failed rate', 'Swap activity log'],
    badge: 'Live',
  },
  {
    name: 'Users',
    gradient: 'linear-gradient(135deg, #052212 0%, #061a10 100%)',
    accent: '#34d399',
    Icon: Users,
    features: ['Active user count', 'Daily new registrations', 'User plan distribution', 'Session monitoring'],
    badge: null,
  },
  {
    name: 'Security',
    gradient: 'linear-gradient(135deg, #0f0520 0%, #0a0318 100%)',
    accent: '#a78bfa',
    Icon: Shield,
    features: ['Error log monitoring', 'Failed tx alerts', 'Admin access control', 'Approval-based access'],
    badge: null,
  },
]

export default function AdminRegisterPage() {
  const [name, setName]       = useState('')
  const [email, setEmail]     = useState('')
  const [password, setPass]   = useState('')
  const [showPw, setShowPw]   = useState(false)
  const [error, setError]     = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const [carouselIdx, setCarouselIdx] = useState(0)
  const carouselNext = useCallback(() => setCarouselIdx(p => (p + 1) % ADMIN_FEATURES.length), [])
  useEffect(() => { const t = setInterval(carouselNext, 4000); return () => clearInterval(t) }, [carouselNext])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!name.trim()) { setError('Full name is required.'); return }
    setLoading(true)
    try {
      let userCred
      try {
        userCred = await createUserWithEmailAndPassword(auth!, email, password)
      } catch (fbErr: unknown) {
        if ((fbErr as { code?: string })?.code === 'auth/email-already-in-use') {
          userCred = await signInWithEmailAndPassword(auth!, email, password)
        } else {
          throw fbErr
        }
      }

      const idToken = await userCred.user.getIdToken()

      const res = await fetch('/api/admin/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, idToken }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Failed to submit request.'); return }
      setSuccess(true)
    } catch (err: unknown) {
      const m = String((err as { code?: string })?.code ?? err)
      if (m.includes('weak-password'))      setError('Password must be at least 6 characters.')
      else if (m.includes('invalid-email')) setError('Please enter a valid email address.')
      else if (m.includes('wrong-password') || m.includes('invalid-credential'))
        setError('Incorrect password for this existing account.')
      else setError('An error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-[100dvh] w-[100dvw] overflow-hidden" style={{ background: '#070710', fontFamily: 'inherit' }}>

      {/* LEFT — form */}
      <section
        className="relative flex flex-col justify-center z-10 w-full lg:w-[33%] xl:w-[30%]"
        style={{ borderRight: '1px solid rgba(255,255,255,0.07)', background: '#0b0b18', minWidth: '320px' }}
      >
        <div className="pointer-events-none absolute top-0 left-0 right-0 h-72"
          style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(124,58,237,0.14) 0%, transparent 70%)' }} />

        {success ? (
          <div className="flex flex-col items-center gap-5 px-8 xl:px-12 py-12 text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(22,163,74,0.15)', border: '1px solid rgba(22,163,74,0.3)' }}>
              <Check className="w-8 h-8" style={{ color: '#16a34a' }} />
            </div>
            <h2 className="text-2xl font-semibold" style={{ color: '#f1f5f9' }}>Request Submitted!</h2>
            <p className="text-sm leading-relaxed" style={{ color: '#6b7280' }}>
              Your admin access request has been sent to the master admin. You will receive an email at{' '}
              <span style={{ color: '#e4e4e7' }}>{email}</span> once reviewed.
            </p>
            <Link href="/admin/login"
              className="w-full text-center rounded-2xl py-3.5 text-sm font-bold flex items-center justify-center gap-2"
              style={{ background: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)', color: '#fff' }}>
              <ShieldCheck className="w-4 h-4" /> Go to Admin Login
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-5 px-8 xl:px-12 py-10 w-full">
            {/* Logo */}
            <div className="flex items-center gap-2.5 mb-1">
              <div className="bg-blue-600 p-2 rounded-xl shadow-lg shadow-blue-500/20 flex items-center justify-center w-9 h-9">
                <Zap className="w-5 h-5 text-white" fill="white" />
              </div>
              <span className="font-black text-lg uppercase tracking-tighter text-zinc-900 dark:text-white" style={{ letterSpacing: '-0.04em' }}>SwapSmith</span>
            </div>

            <div>
              <h1 className="text-4xl font-semibold leading-tight tracking-tighter" style={{ color: '#f1f5f9' }}>
                Request Access
              </h1>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: '#6b7280' }}>
                Submit a request — the master admin will approve via email.
              </p>
            </div>

            {error && (
              <div className="flex items-start gap-3 rounded-xl px-4 py-3 text-sm"
                style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form className="flex flex-col gap-3.5" onSubmit={handleSubmit}>
              {/* Full Name */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#4b5563' }}>Full Name</label>
                <div className="rounded-2xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#374151' }} />
                    <input required value={name} onChange={e => setName(e.target.value)}
                      placeholder="Your full name" disabled={loading}
                      className="w-full bg-transparent text-sm py-3.5 pl-11 pr-4 rounded-2xl focus:outline-none disabled:opacity-40"
                      style={{ color: '#f1f5f9' }} />
                  </div>
                </div>
              </div>

              {/* Email */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#4b5563' }}>Email Address</label>
                <div className="rounded-2xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#374151' }} />
                    <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                      placeholder="you@example.com" disabled={loading}
                      className="w-full bg-transparent text-sm py-3.5 pl-11 pr-4 rounded-2xl focus:outline-none disabled:opacity-40"
                      style={{ color: '#f1f5f9' }} />
                  </div>
                </div>
              </div>

              {/* Password */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#4b5563' }}>Password</label>
                <div className="rounded-2xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#374151' }} />
                    <input type={showPw ? 'text' : 'password'} required value={password}
                      onChange={e => setPass(e.target.value)}
                      placeholder="At least 6 characters" disabled={loading}
                      className="w-full bg-transparent text-sm py-3.5 pl-11 pr-12 rounded-2xl focus:outline-none disabled:opacity-40"
                      style={{ color: '#f1f5f9' }} />
                    <button type="button" onClick={() => setShowPw(p => !p)}
                      className="absolute inset-y-0 right-3 flex items-center transition-colors" style={{ color: '#4b5563' }}>
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Submit */}
              <div className="pt-1 flex justify-center">
                <button type="submit" disabled={loading}
                  className="rounded-2xl py-4 font-bold flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)', color: '#fff', boxShadow: '0 8px 24px rgba(124,58,237,0.35)', width: '80%' }}>
                  {loading
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</>
                    : <><ShieldCheck className="w-4 h-4" /> Request Access <ArrowRight className="w-4 h-4" /></>}
                </button>
              </div>
            </form>

            {/* Divider */}
            <div className="relative flex items-center justify-center">
              <div className="absolute inset-x-0 top-1/2 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
              <span className="relative px-4 text-xs font-semibold uppercase tracking-widest"
                style={{ background: '#0b0b18', color: '#374151' }}>or</span>
            </div>

            <Link href="/admin/login"
              className="block w-full text-center rounded-2xl py-3.5 text-sm font-semibold transition-all duration-200"
              style={{ border: '1px solid rgba(255,255,255,0.08)', color: '#9ca3af' }}>
              Already have access? Sign in
            </Link>

            <p className="flex items-center justify-center gap-1.5 text-center text-xs" style={{ color: '#374151' }}>
              <Zap className="w-3 h-3" fill="currentColor" />
              <Link href="/" style={{ color: '#374151' }}>← Back to SwapSmith</Link>
            </p>
          </div>
        )}
      </section>

      {/* RIGHT — admin features carousel */}
      <section className="hidden md:flex flex-1 relative overflow-hidden flex-col">
        <AuroraBackground />
        <div className="absolute inset-0 pointer-events-none"
          style={{ zIndex: 2, opacity: 0.025, backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.9) 1px, transparent 1px)', backgroundSize: '28px 28px' }} />

        {/* Header */}
        <div className="relative px-10 xl:px-14 pt-6 pb-5"
          style={{ zIndex: 3, borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-3 text-[10px] font-black uppercase tracking-[0.18em]"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', color: '#6b7280' }}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#a78bfa' }} />
            Admin Dashboard
          </div>
          <h2 className="text-3xl xl:text-4xl font-black tracking-tighter leading-[1.08] mb-2" style={{ color: '#f1f5f9' }}>
            Monitor your{' '}
            <span style={{ background: 'linear-gradient(90deg, #60a5fa, #a78bfa, #818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              platform.
            </span>
          </h2>
          <p className="text-xs leading-relaxed" style={{ color: '#4b5563', maxWidth: '300px' }}>
            Real-time analytics, user monitoring, swap tracking &amp; approval-based security.
          </p>
        </div>

        {/* 3D Carousel */}
        <div className="relative flex-1 flex items-center justify-center" style={{ zIndex: 3, minHeight: 0, padding: '20px 0 44px' }}>
          <div className="relative w-full h-full flex items-center justify-center" style={{ perspective: '1200px' }}>
            {ADMIN_FEATURES.map((feat, index) => {
              const total = ADMIN_FEATURES.length
              let pos = (index - carouselIdx + total) % total
              if (pos > Math.floor(total / 2)) pos -= total
              const isCenter   = pos === 0
              const isAdjacent = Math.abs(pos) === 1
              const Icon = feat.Icon
              return (
                <div key={feat.name} className="absolute flex flex-col rounded-3xl overflow-hidden"
                  style={{
                    width: '280px', height: '370px', padding: '24px',
                    background: feat.gradient,
                    border: isCenter ? '1px solid rgba(255,255,255,0.13)' : '1px solid rgba(255,255,255,0.04)',
                    transform: `translateX(${pos * 58}%) scale(${isCenter ? 1 : isAdjacent ? 0.8 : 0.6}) rotateY(${pos * -14}deg)`,
                    zIndex: isCenter ? 10 : isAdjacent ? 5 : 1,
                    opacity: isCenter ? 1 : isAdjacent ? 0.7 : 0,
                    filter: isCenter ? 'none' : 'blur(4px)',
                    visibility: Math.abs(pos) > 1 ? 'hidden' : 'visible',
                    transition: 'all 0.6s cubic-bezier(0.22,1,0.36,1)',
                  }}>
                  {feat.badge && (
                    <div className="absolute top-0 right-0 rounded-bl-xl rounded-tr-3xl px-3 py-1.5 text-[9px] font-black uppercase tracking-widest"
                      style={{ background: '#2563eb', color: '#fff' }}>
                      {feat.badge}
                    </div>
                  )}
                  <div className="mb-5">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg mb-4 text-[11px] font-black uppercase tracking-wider"
                      style={{ background: `${feat.accent}18`, color: feat.accent }}>
                      <Icon className="w-3.5 h-3.5" />
                      {feat.name}
                    </div>
                    <div className="text-2xl font-black leading-snug" style={{ color: '#f1f5f9' }}>
                      Platform<br />Insights
                    </div>
                  </div>
                  <ul className="flex flex-col gap-3 flex-1">
                    {feat.features.map(f => (
                      <li key={f} className="flex items-start gap-2.5 text-[13px] leading-snug" style={{ color: '#9ca3af' }}>
                        <Check className="w-4 h-4 shrink-0 mt-px" style={{ color: feat.accent }} />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
          {/* Dots */}
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex gap-2 z-20">
            {ADMIN_FEATURES.map((feat, i) => (
              <button key={i} onClick={() => setCarouselIdx(i)} className="rounded-full transition-all duration-300"
                style={{ width: i === carouselIdx ? '22px' : '6px', height: '6px', background: i === carouselIdx ? feat.accent : 'rgba(255,255,255,0.18)' }} />
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
