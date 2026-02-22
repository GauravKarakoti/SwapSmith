import { Zap, Puzzle } from 'lucide-react'
import Link from 'next/link'

const PLANNED_INTEGRATIONS = [
  { name: 'Uniswap', category: 'DEX', status: 'Planned' },
  { name: 'Aave', category: 'Lending', status: 'Planned' },
  { name: 'Curve Finance', category: 'DEX', status: 'Planned' },
  { name: 'Compound', category: 'Lending', status: 'Planned' },
  { name: 'SideShift.ai', category: 'Cross-Chain Swap', status: 'Live' },
  { name: 'MetaMask', category: 'Wallet', status: 'Live' },
]

export default function IntegrationsPage() {
  return (
    <main className="min-h-screen bg-[#050505] px-6 py-24">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-14">
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="absolute -inset-2 bg-blue-500 rounded-2xl blur opacity-20" />
              <div className="relative w-16 h-16 bg-zinc-900 border border-white/10 rounded-2xl flex items-center justify-center">
                <Puzzle className="w-8 h-8 text-blue-400" />
              </div>
            </div>
          </div>
          <span className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full text-xs font-bold text-blue-400 uppercase tracking-widest mb-6">
            <Zap className="w-3 h-3" fill="currentColor" />
            Ecosystem
          </span>
          <h1 className="text-4xl font-black text-white tracking-tighter mb-4">Integrations</h1>
          <p className="text-zinc-400 leading-relaxed max-w-xl mx-auto">
            SwapSmith connects with leading DeFi protocols and wallets. More integrations are being added continuously.
          </p>
        </div>

        {/* Integration Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-12">
          {PLANNED_INTEGRATIONS.map((integration) => (
            <div
              key={integration.name}
              className="p-5 bg-white/[0.02] border border-white/8 rounded-xl flex items-center justify-between hover:border-white/15 transition-colors"
            >
              <div>
                <p className="text-white font-semibold text-sm">{integration.name}</p>
                <p className="text-zinc-500 text-xs mt-0.5">{integration.category}</p>
              </div>
              <span
                className={`text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full ${
                  integration.status === 'Live'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-zinc-800 text-zinc-500 border border-zinc-700'
                }`}
              >
                {integration.status}
              </span>
            </div>
          ))}
        </div>

        <div className="text-center">
          <p className="text-zinc-500 text-sm mb-6">
            Want to suggest an integration? Open an issue on GitHub.
          </p>
          <div className="flex items-center justify-center gap-4">
            <a
              href="https://github.com/GauravKarakoti/SwapSmith/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 bg-zinc-800 text-white text-sm font-bold rounded-xl hover:bg-zinc-700 transition-colors"
            >
              Request Integration
            </a>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-6 py-3 bg-white text-black text-sm font-bold rounded-xl hover:bg-zinc-200 transition-colors"
            >
              ← Back to Home
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}