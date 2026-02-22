import { Zap, TrendingUp } from 'lucide-react'
import Link from 'next/link'

export default function YieldScoutPage() {
  return (
    <main className="min-h-screen bg-[#050505] flex flex-col items-center justify-center px-6 text-center">
      <div className="max-w-xl">
        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="relative group">
            <div className="absolute -inset-2 bg-blue-500 rounded-2xl blur opacity-20" />
            <div className="relative w-16 h-16 bg-zinc-900 border border-white/10 rounded-2xl flex items-center justify-center">
              <TrendingUp className="w-8 h-8 text-blue-400" />
            </div>
          </div>
        </div>

        {/* Badge */}
        <span className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full text-xs font-bold text-blue-400 uppercase tracking-widest mb-6">
          <Zap className="w-3 h-3" fill="currentColor" />
          Coming Soon
        </span>

        <h1 className="text-4xl font-black text-white tracking-tighter mb-4">
          Yield Scout
        </h1>
        <p className="text-zinc-400 leading-relaxed mb-8">
          Automatically discover and compare the best yield opportunities across DeFi protocols — 
          powered by natural language. Yield Scout is currently under active development and will 
          be available soon.
        </p>

        {/* Teaser features */}
        <ul className="text-left space-y-3 mb-10">
          {[
            'Compare APY across 50+ protocols in real-time',
            'Risk-scored yield recommendations',
            'One-click deposit via SwapSmith voice commands',
            'Portfolio yield tracking & alerts',
          ].map((f) => (
            <li key={f} className="flex items-start gap-3 text-sm text-zinc-400">
              <span className="mt-1 w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
              {f}
            </li>
          ))}
        </ul>

        <Link
          href="/"
          className="inline-flex items-center gap-2 px-6 py-3 bg-white text-black text-sm font-bold rounded-xl hover:bg-zinc-200 transition-colors"
        >
          ← Back to Home
        </Link>
      </div>
    </main>
  )
}