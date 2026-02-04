'use client'

import { useRouter } from 'next/navigation'
import { Zap, Mic, Shield, BarChart3, ArrowRight, Globe } from 'lucide-react'

export default function LandingPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center selection:bg-blue-500/30">
      {/* Background Glows */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-600/10 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-purple-600/10 blur-[120px]" />
      </div>

      {/* Floating Nav */}
      <nav className="fixed top-6 z-50 w-[90%] max-w-4xl bg-white/[0.03] border border-white/10 backdrop-blur-xl rounded-full px-6 py-3 flex justify-between items-center shadow-2xl">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-blue-500" fill="currentColor" />
          <span className="font-black tracking-tighter text-lg uppercase">SwapSmith</span>
        </div>
        <button 
          onClick={() => router.push('/terminal')}
          className="text-[10px] font-black uppercase tracking-widest bg-white text-black px-6 py-2.5 rounded-full hover:bg-zinc-200 transition-all active:scale-95"
        >
          Enter Terminal
        </button>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-48 pb-20 px-6 text-center z-10">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-black uppercase tracking-[0.2em]">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
            </span>
            V1.0 Live on Mainnet
          </div>
          
          <h1 className="text-6xl md:text-8xl font-black tracking-tighter leading-[0.85] bg-clip-text text-transparent bg-gradient-to-b from-white to-white/40">
            THE VOICE OF <br /> MODERN DEFI.
          </h1>
          
          <p className="text-lg md:text-xl text-zinc-400 max-w-2xl mx-auto font-medium leading-relaxed">
            Execute complex cross-chain swaps and scout the highest yields across 20+ protocols using only natural language.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-6">
            <button 
              onClick={() => router.push('/')}
              className="group relative px-10 py-4 bg-blue-600 rounded-2xl font-bold text-lg transition-all hover:scale-105 hover:shadow-[0_0_40px_rgba(37,99,235,0.4)]"
            >
              <div className="flex items-center gap-2">
                Launch App <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </div>
            </button>
          </div>
        </div>
      </section>

      {/* Bento Grid Features */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 py-24 w-full grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 p-10 bg-white/[0.02] border border-white/5 rounded-[2.5rem] space-y-6 hover:border-white/10 transition-colors">
          <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center border border-blue-500/20">
            <Mic className="w-6 h-6 text-blue-400" />
          </div>
          <div className="space-y-2">
            <h3 className="text-3xl font-bold tracking-tight">AI Voice Execution</h3>
            <p className="text-zinc-500 text-lg leading-relaxed">Trade faster than you can type. Our Groq-powered engine parses complex intent and prepares orders in milliseconds.</p>
          </div>
        </div>

        <div className="p-10 bg-white/[0.02] border border-white/5 rounded-[2.5rem] space-y-6 hover:border-white/10 transition-colors">
          <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center border border-emerald-500/20">
            <Shield className="w-6 h-6 text-emerald-400" />
          </div>
          <h3 className="text-3xl font-bold tracking-tight">Secure</h3>
          <p className="text-zinc-500 leading-relaxed text-lg">Non-custodial by design. We never hold your keys.</p>
        </div>

        <div className="p-10 bg-white/[0.02] border border-white/5 rounded-[2.5rem] space-y-6 hover:border-white/10 transition-colors">
          <div className="w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center border border-purple-500/20">
            <BarChart3 className="w-6 h-6 text-purple-400" />
          </div>
          <h3 className="text-3xl font-bold tracking-tight">Yield Scout</h3>
          <p className="text-zinc-500 leading-relaxed text-lg">Scan top-tier protocols for the best APYs instantly.</p>
        </div>

        <div className="md:col-span-2 p-10 bg-white/[0.02] border border-white/5 rounded-[2.5rem] flex items-center justify-between group overflow-hidden">
          <div className="space-y-4 max-w-md">
            <h3 className="text-3xl font-bold tracking-tight">Multi-Chain Routing</h3>
            <p className="text-zinc-500 text-lg leading-relaxed">Bridge and swap across Ethereum, Polygon, Base, and Arbitrum without leaving the chat.</p>
          </div>
          <Globe className="w-32 h-32 text-white/[0.03] group-hover:text-blue-500/10 transition-colors duration-1000" strokeWidth={1} />
        </div>
      </section>

      {/* Simple Footer for Landing Only */}
      <div className="py-12 text-zinc-600 text-[10px] font-bold uppercase tracking-[0.3em]">
        SwapSmith Terminal © 2026
      </div>
    </div>
  )
}