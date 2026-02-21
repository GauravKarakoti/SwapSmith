import { Shield, Lock, AlertTriangle, Github } from 'lucide-react'
import Link from 'next/link'

export default function SecurityPage() {
  return (
    <main className="min-h-screen bg-[#050505] px-6 py-24">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-14">
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="absolute -inset-2 bg-emerald-500 rounded-2xl blur opacity-20" />
              <div className="relative w-16 h-16 bg-zinc-900 border border-white/10 rounded-2xl flex items-center justify-center">
                <Shield className="w-8 h-8 text-emerald-400" />
              </div>
            </div>
          </div>
          <h1 className="text-4xl font-black text-white tracking-tighter mb-4">Security</h1>
          <p className="text-zinc-400 leading-relaxed max-w-xl mx-auto">
            Security is a top priority for SwapSmith. We follow industry best practices to keep your funds and data safe.
          </p>
        </div>

        {/* Principles */}
        <div className="space-y-4 mb-12">
          {[
            {
              icon: Lock,
              title: 'Non-Custodial',
              description:
                'SwapSmith never holds your private keys or funds. All transactions are signed locally in your wallet (e.g. MetaMask) and you retain full custody at all times.',
            },
            {
              icon: Shield,
              title: 'Explicit Confirmation Required',
              description:
                'No swap or transaction is ever executed without your explicit on-screen confirmation. The AI agent only suggests — you decide.',
            },
            {
              icon: AlertTriangle,
              title: 'Responsible Disclosure',
              description:
                'If you discover a security vulnerability, please report it responsibly via our GitHub repository rather than disclosing it publicly. We aim to address all valid reports promptly.',
            },
          ].map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="p-6 bg-white/[0.02] border border-white/8 rounded-xl flex gap-5 hover:border-white/15 transition-colors"
            >
              <div className="shrink-0 w-10 h-10 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-center justify-center">
                <Icon className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-white font-bold mb-1">{title}</h3>
                <p className="text-zinc-400 text-sm leading-relaxed">{description}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Report CTA */}
        <div className="p-6 bg-emerald-500/5 border border-emerald-500/15 rounded-xl text-center mb-10">
          <h3 className="text-white font-bold mb-2">Found a vulnerability?</h3>
          <p className="text-zinc-400 text-sm mb-4">
            Please open a GitHub issue marked <span className="text-emerald-400 font-semibold">[Security]</span> or contact the maintainer directly.
          </p>
          <a
            href="https://github.com/GauravKarakoti/SwapSmith/issues"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white text-sm font-bold rounded-xl hover:bg-emerald-500 transition-colors"
          >
            <Github className="w-4 h-4" />
            Report on GitHub
          </a>
        </div>

        <div className="text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-white text-black text-sm font-bold rounded-xl hover:bg-zinc-200 transition-colors"
          >
            ← Back to Home
          </Link>
        </div>
      </div>
    </main>
  )
}