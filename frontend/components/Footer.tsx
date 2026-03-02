'use client'

import { Github, Twitter, MessageCircle, ExternalLink, Zap, ArrowUpRight, Loader2 } from 'lucide-react'
import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'

export default function Footer() {
  const currentYear = new Date().getFullYear()
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [waitlistCount, setWaitlistCount] = useState<number | null>(null)

  // Fetch waitlist count on mount
  useEffect(() => {
    fetchWaitlistCount()
  }, [])

  const fetchWaitlistCount = async () => {
    try {
      const response = await fetch('/api/waitlist/count')
      const data = await response.json()
      if (data.success) {
        setWaitlistCount(data.count)
      }
    } catch (error) {
      console.error('Failed to fetch waitlist count:', error)
    }
  }

  const validateEmail = (email: string) => {
    const emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/
    return emailRegex.test(email)
  }

  const handleJoinWaitlist = async () => {
    // Validate email
    if (!email.trim()) {
      toast.error('Please enter your email address')
      return
    }

    if (!validateEmail(email)) {
      toast.error('Please enter a valid email address')
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch('/api/waitlist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()

      if (response.ok) {
        toast.success(data.message || 'Successfully joined the waitlist!')
        // Refresh count
        fetchWaitlistCount()
      } else {
        toast.error(data.error || 'Something went wrong')
      }
    } catch (error) {
      console.error('Error joining waitlist:', error)
      toast.error('Network error. Please try again.')
    } finally {
      setEmail('')
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !isLoading) {
      handleJoinWaitlist()
    }
  }

  return (
    <footer className="relative w-full mt-20 overflow-hidden border-t border-slate-200/50 dark:border-white/5 bg-slate-50 dark:bg-[#050505]">
      {/* 1. Decorative Background Elements */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-px bg-gradient-to-r from-transparent via-blue-500/50 to-transparent" />
      <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[600px] h-[200px] bg-blue-500/10 dark:bg-blue-600/10 blur-[100px] rounded-full" />
      
      {/* 2. Grid Overlay Pattern */}
      <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.02] pointer-events-none"
           style={{ backgroundImage: `radial-gradient(circle, currentColor 1px, transparent 1px)`, backgroundSize: '30px 30px' }} />

      <div className="relative max-w-7xl mx-auto px-6 pt-16 pb-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 mb-16">

          <div className="lg:col-span-5 space-y-8">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="relative group">
                  <div className="absolute -inset-1 bg-blue-500 rounded-lg blur opacity-25 group-hover:opacity-50 transition duration-1000" />
                  <div className="relative w-10 h-10 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-lg flex items-center justify-center shadow-md dark:shadow-none">
                    <Zap className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="currentColor" />
                  </div>
                </div>
                <span className="text-2xl font-black tracking-tighter text-slate-900 dark:text-white">SwapSmith</span>
              </div>
              <p className="text-base text-slate-600 dark:text-zinc-400 leading-relaxed max-w-sm">
                The intelligent voice-layer for DeFi. Redefining how you interact with the blockchain through natural language.
              </p>
            </div>

            <div className="space-y-3">
              <div className="relative max-w-sm group">
                <input
                  type="email"
                  placeholder="Join the waitlist"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyPress={handleKeyPress}
                  disabled={isLoading}
                  className="w-full bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-600 outline-none focus:border-blue-500/50 shadow-sm dark:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <button
                  onClick={handleJoinWaitlist}
                  disabled={isLoading}
                  className="absolute right-1.5 top-1.5 bottom-1.5 px-4 bg-slate-900 dark:bg-white text-white dark:text-black text-xs font-bold rounded-lg hover:bg-slate-800 dark:hover:bg-zinc-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Joining...
                    </>
                  ) : (
                    'Join'
                  )}
                </button>
              </div>
              {waitlistCount !== null && waitlistCount > 0 && (
                <p className="text-xs text-zinc-500 flex items-center gap-1.5">
                  <span className="text-orange-500">🔥</span>
                  <span className="font-semibold text-orange-400">{waitlistCount}</span> 
                  {waitlistCount === 1 ? 'person has' : 'people have'} already joined the waitlist
                </p>
              )}
            </div>
          </div>

          <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-3 gap-8">
            <div className="space-y-6">
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-zinc-500">Ecosystem</h4>
              <ul className="space-y-4">
                {[
                  { label: 'Terminal', href: '/terminal' },
                  { label: 'Yield Scout', href: '/yield-scout' },
                  { label: 'Integrations', href: '/integration' },
                ].map((item) => (
                  <li key={item.label}>
                    <a href={item.href} className="text-sm text-slate-500 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-white flex items-center gap-1 group transition-colors">
                      {item.label} <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-all -translate-y-1 group-hover:translate-y-0" />
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-6">
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-zinc-500">Governance</h4>
              <ul className="space-y-4">
                <li>
                  <a href="/security" className="text-sm text-slate-500 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-white transition-colors">Security</a>
                </li>
                <li>
                  <a href="/docs" className="text-sm text-slate-500 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-white transition-colors">Documentation</a>
                </li>
                <li>
                  <a href="/privacy" className="text-sm text-slate-500 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-white transition-colors">Privacy Policy</a>
                </li>
              </ul>
            </div>

            <div className="space-y-6 col-span-2 sm:col-span-1">
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-zinc-500">Connect</h4>
              <div className="flex flex-wrap gap-3">
                <a href="https://twitter.com/SwapSmith" target="_blank" rel="noopener noreferrer" className="p-2.5 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-slate-400 dark:text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 hover:bg-slate-200 dark:hover:border-blue-400/50 transition-all">
                  <Twitter className="w-5 h-5" />
                </a>
                <a href="https://github.com/GauravKarakoti/SwapSmith" target="_blank" rel="noopener noreferrer" className="p-2.5 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-slate-400 dark:text-gray-400 hover:text-gray-900 dark:hover:text-blue-400 hover:bg-slate-200 dark:hover:border-blue-400/50 transition-all">
                  <Github className="w-5 h-5" />
                </a>
                <a href="https://t.me/SwapSmithBot" target='_blank' rel="noopener noreferrer" className="p-2.5 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-slate-400 dark:text-gray-400 hover:text-[#229ED9] hover:bg-slate-200 dark:hover:border-[#229ED9]/50 transition-all">
                  <MessageCircle className="w-5 h-5" />
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Bottom Bar with "Cyber" Aesthetics */}
        <div className="pt-8 border-t border-slate-200 dark:border-white/5 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-8">
            <p className="text-[10px] text-slate-400 dark:text-zinc-600 font-bold uppercase tracking-widest">
              © {currentYear} SWAPSMITH
            </p>
            <div className="hidden md:flex items-center gap-4">
              <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/5 border border-emerald-500/20 dark:border-emerald-500/10 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-500 uppercase tracking-widest">Network Secure</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <a href="/legal" className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-200 transition-colors uppercase tracking-widest flex items-center gap-1.5">
              Legal <ExternalLink className="w-3 h-3" />
            </a>
            <div className="h-4 w-px bg-slate-200 dark:bg-white/10" />
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest">v1.0.4-beta</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}