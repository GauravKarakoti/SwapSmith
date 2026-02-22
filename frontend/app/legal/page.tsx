import { Scale } from 'lucide-react'
import Link from 'next/link'

export default function LegalPage() {
  const lastUpdated = 'February 2026'

  return (
    <main className="min-h-screen bg-[#050505] px-6 py-24">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-14">
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="absolute -inset-2 bg-blue-500 rounded-2xl blur opacity-20" />
              <div className="relative w-16 h-16 bg-zinc-900 border border-white/10 rounded-2xl flex items-center justify-center">
                <Scale className="w-8 h-8 text-blue-400" />
              </div>
            </div>
          </div>
          <h1 className="text-4xl font-black text-white tracking-tighter mb-4">Legal &amp; Terms</h1>
          <p className="text-zinc-500 text-sm">Last updated: {lastUpdated}</p>
        </div>

        {/* Sections */}
        <div className="space-y-8 text-zinc-400 text-sm leading-relaxed mb-12">
          <section>
            <h2 className="text-white font-bold text-lg mb-3">1. Acceptance of Terms</h2>
            <p>
              By accessing or using SwapSmith (&quot;the Service&quot;), you agree to be bound by these Terms of Service.
              If you do not agree to these terms, please do not use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-white font-bold text-lg mb-3">2. Description of Service</h2>
            <p>
              SwapSmith is an AI-powered interface that facilitates cryptocurrency swap suggestions via natural language.
              SwapSmith does not execute transactions autonomously — all transactions require your explicit confirmation
              and are processed through third-party protocols such as SideShift.ai.
            </p>
          </section>

          <section>
            <h2 className="text-white font-bold text-lg mb-3">3. Non-Custodial &amp; No Financial Advice</h2>
            <p>
              SwapSmith is a non-custodial tool. We do not hold, manage, or have access to your cryptocurrency assets
              or private keys at any time. Nothing on this platform constitutes financial, investment, or legal advice.
              Cryptocurrency trading involves significant risk. Use the Service at your own risk.
            </p>
          </section>

          <section>
            <h2 className="text-white font-bold text-lg mb-3">4. Third-Party Services</h2>
            <p>
              SwapSmith relies on third-party APIs (including SideShift.ai and OpenAI). We are not responsible for
              the availability, accuracy, or actions of these third-party services. Their respective terms of service apply.
            </p>
          </section>

          <section>
            <h2 className="text-white font-bold text-lg mb-3">5. Limitation of Liability</h2>
            <p>
              To the fullest extent permitted by law, SwapSmith and its contributors shall not be liable for any
              indirect, incidental, special, or consequential damages arising from the use or inability to use the Service,
              including any loss of funds or data.
            </p>
          </section>

          <section>
            <h2 className="text-white font-bold text-lg mb-3">6. Changes to Terms</h2>
            <p>
              We reserve the right to modify these terms at any time. Continued use of the Service after any changes
              constitutes your acceptance of the new terms. We will update the &quot;Last updated&quot; date at the top of this page.
            </p>
          </section>

          <section>
            <h2 className="text-white font-bold text-lg mb-3">7. Contact</h2>
            <p>
              For legal inquiries, please open an issue on our{' '}
              <a
                href="https://github.com/GauravKarakoti/SwapSmith"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 underline"
              >
                GitHub repository
              </a>
              .
            </p>
          </section>
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