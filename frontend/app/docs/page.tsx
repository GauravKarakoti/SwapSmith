import { BookOpen, ExternalLink, Zap, Terminal, Wallet, MessageSquare } from 'lucide-react'
import Link from 'next/link'

const QUICK_LINKS = [
  {
    icon: Zap,
    title: 'Getting Started',
    description: 'Set up SwapSmith locally and make your first swap in minutes.',
    href: 'https://github.com/GauravKarakoti/SwapSmith#-installation--setup',
  },
  {
    icon: Terminal,
    title: 'Terminal Guide',
    description: 'Learn how to use the AI terminal to execute natural-language swaps.',
    href: '/terminal',
    internal: true,
  },
  {
    icon: Wallet,
    title: 'Wallet Connection',
    description: 'How to connect MetaMask and other Web3 wallets to SwapSmith.',
    href: 'https://github.com/GauravKarakoti/SwapSmith#-how-to-use',
  },
  {
    icon: MessageSquare,
    title: 'Community & Support',
    description: 'Join the Telegram bot or open a GitHub issue for support.',
    href: 'https://t.me/SwapSmithBot',
  },
]

export default function DocsPage() {
  return (
    <main className="min-h-screen bg-[#050505] px-6 py-24">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-14">
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="absolute -inset-2 bg-blue-500 rounded-2xl blur opacity-20" />
              <div className="relative w-16 h-16 bg-zinc-900 border border-white/10 rounded-2xl flex items-center justify-center">
                <BookOpen className="w-8 h-8 text-blue-400" />
              </div>
            </div>
          </div>
          <span className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full text-xs font-bold text-blue-400 uppercase tracking-widest mb-6">
            Documentation
          </span>
          <h1 className="text-4xl font-black text-white tracking-tighter mb-4">Docs</h1>
          <p className="text-zinc-400 leading-relaxed max-w-xl mx-auto">
            Everything you need to understand and use SwapSmith. Full documentation is hosted on GitHub.
          </p>
        </div>

        {/* Quick links grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
          {QUICK_LINKS.map(({ icon: Icon, title, description, href, internal }) => (
            internal ? (
              <Link
                key={title}
                href={href}
                className="p-5 bg-white/[0.02] border border-white/8 rounded-xl hover:border-blue-500/30 hover:bg-blue-500/5 transition-all group"
              >
                <div className="w-9 h-9 bg-blue-500/10 border border-blue-500/20 rounded-lg flex items-center justify-center mb-3">
                  <Icon className="w-4 h-4 text-blue-400" />
                </div>
                <h3 className="text-white font-bold text-sm mb-1 group-hover:text-blue-300 transition-colors">{title}</h3>
                <p className="text-zinc-500 text-xs leading-relaxed">{description}</p>
              </Link>
            ) : (
              <a
                key={title}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="p-5 bg-white/[0.02] border border-white/8 rounded-xl hover:border-blue-500/30 hover:bg-blue-500/5 transition-all group"
              >
                <div className="w-9 h-9 bg-blue-500/10 border border-blue-500/20 rounded-lg flex items-center justify-center mb-3">
                  <Icon className="w-4 h-4 text-blue-400" />
                </div>
                <h3 className="text-white font-bold text-sm mb-1 group-hover:text-blue-300 transition-colors flex items-center gap-1">
                  {title} <ExternalLink className="w-3 h-3 opacity-50" />
                </h3>
                <p className="text-zinc-500 text-xs leading-relaxed">{description}</p>
              </a>
            )
          ))}
        </div>

        {/* Full README CTA */}
        <div className="p-6 bg-white/[0.02] border border-white/8 rounded-xl text-center mb-10">
          <h3 className="text-white font-bold mb-2">Full Documentation</h3>
          <p className="text-zinc-400 text-sm mb-4">
            The complete README with all setup instructions, API details, and architecture overview is available on GitHub.
          </p>
          <a
            href="https://github.com/GauravKarakoti/SwapSmith#readme"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-500 transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            View on GitHub
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