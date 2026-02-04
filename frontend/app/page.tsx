'use client'

import { useRouter } from 'next/navigation'
import { Zap, Mic, Shield, ArrowRight, Wallet, MessageSquare, CheckCircle, ListChecks, BarChart3 } from 'lucide-react'

export default function LandingPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-[#050505] text-white selection:bg-blue-500/30 font-sans">
      {/* 1. Sleek Navbar */}
      <nav className="fixed top-0 w-full z-50 border-b border-white/5 bg-[#050505]/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-20 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Zap className="w-6 h-6 text-blue-500" fill="currentColor" />
            <span className="text-xl font-black tracking-tighter uppercase">SwapSmith</span>
          </div>
          <button 
            onClick={() => router.push('/terminal')}
            className="group flex items-center gap-2 bg-white text-black px-6 py-2.5 rounded-full text-xs font-bold uppercase tracking-widest hover:bg-zinc-200 transition-all active:scale-95 shadow-[0_0_20px_rgba(255,255,255,0.1)]"
          >
            Launch App <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </nav>

      {/* 2. Hero Section */}
      <section className="relative pt-30 pb-20 px-6 overflow-hidden">
        {/* Ambient Glows */}
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-full max-w-4xl h-[400px] bg-blue-600/10 blur-[120px] rounded-full pointer-events-none" />
        
        <div className="max-w-5xl mx-auto text-center space-y-8 relative z-10">
          <h1 className="text-6xl md:text-8xl font-black tracking-tighter leading-[0.9] bg-clip-text text-transparent bg-gradient-to-b from-white to-white/40">
            YOUR VOICE-ACTIVATED <br /> TRADING ASSISTANT.
          </h1>
          
          <p className="text-lg md:text-2xl text-zinc-400 max-w-2xl mx-auto font-medium">
            Execute complex, cross-chain cryptocurrency swaps using simple natural language.
          </p>

          <div className="bg-white/5 border border-white/10 p-4 rounded-2xl max-w-md mx-auto italic text-zinc-400 text-sm md:text-base">
            "Swap half of my MATIC on Polygon for 50 USDC on Arbitrum."
          </div>

          <div className="pt-2">
            <button 
              onClick={() => router.push('/terminal')}
              className="px-12 py-5 bg-blue-600 rounded-2xl font-black text-xl hover:scale-105 transition-all shadow-lg shadow-blue-600/20 active:scale-95"
            >
              Start Trading Now
            </button>
          </div>
        </div>
      </section>

      {/* 3. Features Grid (From README) */}
      <section className="max-w-6xl mx-auto px-6 py-24 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="p-8 bg-white/[0.02] border border-white/5 rounded-3xl space-y-4">
          <MessageSquare className="w-8 h-8 text-blue-400" />
          <h3 className="text-xl font-bold">Natural Language</h3>
          <p className="text-zinc-500 text-sm leading-relaxed">Describe the swap you want in plain English. No complex forms required.</p>
        </div>
        <div className="p-8 bg-white/[0.02] border border-white/5 rounded-3xl space-y-4">
          <Zap className="w-8 h-8 text-purple-400" />
          <h3 className="text-xl font-bold">Cross-Chain Magic</h3>
          <p className="text-zinc-500 text-sm leading-relaxed">Seamlessly swap between 200+ assets across 40+ chains using SideShift.ai API.</p>
        </div>
        <div className="p-8 bg-white/[0.02] border border-white/5 rounded-3xl space-y-4">
          <Mic className="w-8 h-8 text-red-400" />
          <h3 className="text-xl font-bold">Voice Input</h3>
          <p className="text-zinc-500 text-sm leading-relaxed">Experimental voice integration allows you to command the agent hands-free.</p>
        </div>
        <div className="p-8 bg-white/[0.02] border border-white/5 rounded-3xl space-y-4">
          <Shield className="w-8 h-8 text-emerald-400" />
          <h3 className="text-xl font-bold">Self-Custodial</h3>
          <p className="text-zinc-500 text-sm leading-relaxed">Your keys stay yours. Transactions are only executed after your explicit confirmation.</p>
        </div>
        <div className="p-8 bg-white/[0.02] border border-white/5 rounded-3xl space-y-4">
          <BarChart3 className="w-8 h-8 text-orange-400" />
          <h3 className="text-xl font-bold">Real-Time Quotes</h3>
          <p className="text-zinc-500 text-sm leading-relaxed">Always get the best available rate via SideShift integration.</p>
        </div>
      </section>

      {/* 4. How it Works (From README) */}
      <section className="max-w-4xl mx-auto px-6 py-24">
        <h2 className="text-4xl font-black tracking-tighter text-center mb-16">HOW IT WORKS</h2>
        <div className="space-y-4">
          {[
            { step: 1, text: "Connect Your Wallet (e.g., MetaMask).", icon: Wallet },
            { step: 2, text: "Type or Speak your swap command into the chat.", icon: Mic },
            { step: 3, text: "Review the parsed intent and the live quote provided by SideShift.", icon: ListChecks },
            { step: 4, text: "Confirm the transaction directly in your wallet.", icon: CheckCircle },
            { step: 5, text: "Relax while SwapSmith handles the logic in the background.", icon: Zap },
          ].map((item, idx) => (
            <div key={idx} className="flex items-center gap-6 p-6 bg-white/[0.02] border border-white/5 rounded-2xl group hover:border-blue-500/30 transition-colors">
              <div className="text-2xl font-black text-white/20 group-hover:text-blue-500 transition-colors">0{item.step}</div>
              <item.icon className="w-6 h-6 text-blue-400 flex-shrink-0" />
              <p className="text-lg font-medium text-zinc-300">{item.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 5. Minimal Tech Footer */}
      <footer className="py-20 border-t border-white/5 text-center bg-black">
        <div className="max-w-7xl mx-auto px-6 flex flex-col items-center gap-6">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-zinc-500" />
            <span className="text-sm font-bold text-zinc-500 tracking-widest uppercase">SwapSmith Terminal</span>
          </div>
        </div>
      </footer>
    </div>
  )
}