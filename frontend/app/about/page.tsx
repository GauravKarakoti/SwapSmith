'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import {
  Shield,
  Rocket,
  Layers,
  Sparkles,
  Trophy,
  Star,
  GitFork,
  AlertCircle,
  ExternalLink,
  Gift,
  Zap,
  BookOpen,
  MessageSquare,
  Wallet,
  Clock,
  ArrowRight,
  Github,
  Code2,
  Users,
} from 'lucide-react';

/* ================================================================ */
/*  Static contributor data (GauravKarakoti/SwapSmith)              */
/* ================================================================ */
const CONTRIBUTORS = [
  { login: 'GauravKarakoti',    contributions: 242, avatar: 'https://avatars.githubusercontent.com/u/180496085?v=4' },
  { login: 'deekshithgowda85', contributions: 39,  avatar: 'https://avatars.githubusercontent.com/u/152056807?v=4' },
  { login: 'Omkarop0808',       contributions: 36,  avatar: 'https://avatars.githubusercontent.com/u/194948962?v=4' },
  { login: 'Aditya8369',        contributions: 28,  avatar: 'https://avatars.githubusercontent.com/u/178887069?v=4' },
  { login: 'ayonpaul8906',      contributions: 25,  avatar: 'https://avatars.githubusercontent.com/u/179435490?v=4' },
  { login: 'navin-oss',         contributions: 20,  avatar: 'https://avatars.githubusercontent.com/u/181780004?v=4' },
  { login: 'vedhapprakashni',   contributions: 17,  avatar: 'https://avatars.githubusercontent.com/u/126845490?v=4' },
  { login: 'madhav2348',        contributions: 13,  avatar: 'https://avatars.githubusercontent.com/u/161720210?v=4' },
  { login: 'mdashad0',          contributions: 11,  avatar: 'https://avatars.githubusercontent.com/u/230215489?v=4' },
  { login: 'udaykiran243',      contributions: 6,   avatar: 'https://avatars.githubusercontent.com/u/132606304?v=4' },
  { login: 'Sandhu2702',        contributions: 5,   avatar: 'https://avatars.githubusercontent.com/u/163800371?v=4' },
  { login: 'ARUNNG2004',        contributions: 1,   avatar: 'https://avatars.githubusercontent.com/u/92279619?v=4'  },
  { login: 'AnushSingla',       contributions: 1,   avatar: 'https://avatars.githubusercontent.com/u/164995279?v=4' },
  { login: 'Aradhya1410',       contributions: 1,   avatar: 'https://avatars.githubusercontent.com/u/200644635?v=4' },
  { login: 'arijitkroy',        contributions: 1,   avatar: 'https://avatars.githubusercontent.com/u/83859073?v=4'  },
  { login: 'VedantBudhabaware', contributions: 1,   avatar: 'https://avatars.githubusercontent.com/u/205757172?v=4' },
  { login: 'soumojit-D48',      contributions: 1,   avatar: 'https://avatars.githubusercontent.com/u/207209292?v=4' },
  { login: 'surajsbhoj0101',    contributions: 1,   avatar: 'https://avatars.githubusercontent.com/u/208060550?v=4' },
  { login: 'VinayKumar42',      contributions: 1,   avatar: 'https://avatars.githubusercontent.com/u/196925653?v=4' },
];

const REPO_STATS = { stars: 3, forks: 22, openIssues: 54, language: 'TypeScript' };

const REWARD_ACTIONS = [
  { icon: <Trophy  className="w-5 h-5" />, color: 'from-yellow-400 to-amber-500',   label: 'Daily Login',       desc: 'Earn points just by showing up every day.',                points: '+10 pts' },
  { icon: <BookOpen className="w-5 h-5" />, color: 'from-cyan-400 to-blue-500',     label: 'Complete a Course', desc: 'Finish any module in the Learn section.',                  points: '+50 pts' },
  { icon: <Zap     className="w-5 h-5" />, color: 'from-purple-400 to-violet-500',  label: 'Execute a Swap',    desc: 'Use the terminal to swap any crypto asset.',               points: '+25 pts' },
  { icon: <MessageSquare className="w-5 h-5" />, color: 'from-pink-400 to-rose-500', label: 'Use AI Terminal',  desc: 'Chat with the SwapSmith AI for trading insights.',          points: '+15 pts' },
  { icon: <Wallet  className="w-5 h-5" />, color: 'from-green-400 to-emerald-500',  label: 'Connect Wallet',    desc: 'Link your Web3 wallet to unlock the full platform.',       points: '+20 pts' },
  { icon: <Clock   className="w-5 h-5" />, color: 'from-orange-400 to-amber-500',   label: 'Setup DCA',         desc: 'Create a Dollar Cost Averaging schedule.',                 points: '+30 pts' },
  { icon: <Gift    className="w-5 h-5" />, color: 'from-indigo-400 to-blue-500',    label: 'Claim Tokens',      desc: 'Convert your accumulated points into real on-chain tokens.', points: 'Claim!' },
];

/* ================================================================ */
/*  Helpers                                                          */
/* ================================================================ */
const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 40 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, delay },
});

/* ================================================================ */
/*  Sub-components                                                   */
/* ================================================================ */

function GlassCard({
  children,
  title,
  icon,
  className = '',
}: {
  children: React.ReactNode;
  title?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      whileHover={{ y: -6 }}
      transition={{ type: 'spring', stiffness: 200 }}
      className={`relative backdrop-blur-xl bg-gradient-to-br from-white/10 via-white/5 to-transparent border border-white/15 rounded-3xl p-8 shadow-xl hover:shadow-[0_0_60px_rgba(34,211,238,0.25)] transition-all duration-500 ${className}`}
    >
      {title && (
        <div className="flex items-center gap-4 mb-6">
          {icon && (
            <div className="p-3 rounded-xl bg-gradient-to-r from-cyan-400 via-blue-500 to-violet-500 text-white shadow-lg">
              {icon}
            </div>
          )}
          <h2 className="text-2xl font-bold text-white tracking-wide">{title}</h2>
        </div>
      )}
      {children}
    </motion.div>
  );
}

function FeatureList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-3">
      {items.map((item, i) => (
        <li
          key={i}
          className="relative pl-6 text-gray-300 hover:text-white transition-all duration-300 before:absolute before:left-0 before:top-2 before:w-2.5 before:h-2.5 before:rounded-full before:bg-gradient-to-r before:from-violet-400 before:to-cyan-400"
        >
          {item}
        </li>
      ))}
    </ul>
  );
}

function StatBadge({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="flex flex-col items-center gap-1 px-6 py-4 rounded-2xl bg-white/5 border border-white/10 hover:border-cyan-400/40 transition-all duration-300">
      <div className="text-cyan-400">{icon}</div>
      <span className="text-2xl font-extrabold text-white">{value}</span>
      <span className="text-xs text-gray-400 uppercase tracking-wider">{label}</span>
    </div>
  );
}

function ContributorCard({ login, avatar, contributions, index }: { login: string; avatar: string; contributions: number; index: number }) {
  const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : null;
  return (
    <motion.a
      href={`https://github.com/${login}`}
      target="_blank"
      rel="noopener noreferrer"
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, delay: index * 0.04 }}
      whileHover={{ y: -6, scale: 1.05 }}
      className={`relative flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all duration-300 cursor-pointer group ${
        index < 3
          ? 'bg-gradient-to-b from-white/15 to-white/5 border-cyan-400/30 shadow-[0_0_30px_rgba(34,211,238,0.15)]'
          : 'bg-white/5 border-white/10 hover:border-white/25'
      }`}
    >
      {medal && <span className="absolute -top-2 -right-2 text-lg leading-none">{medal}</span>}
      <Image
        src={avatar}
        alt={login}
        width={56}
        height={56}
        className="rounded-full border-2 border-white/20 group-hover:border-cyan-400 transition-all duration-300"
        unoptimized
      />
      <span className="text-sm font-semibold text-white truncate max-w-[100px] text-center">{login}</span>
      <span className="text-xs text-gray-400">{contributions} commits</span>
    </motion.a>
  );
}

/* ================================================================ */
/*  Main Page                                                        */
/* ================================================================ */
export default function AboutPage() {
  const [totalCommits, setTotalCommits] = useState(0);
  useEffect(() => setTotalCommits(CONTRIBUTORS.reduce((s, c) => s + c.contributions, 0)), []);

  return (
    <>
      <Navbar />

      <div
        className="relative min-h-screen overflow-hidden pt-32 pb-24 px-6
          bg-[radial-gradient(circle_at_20%_20%,rgba(124,58,237,0.35),transparent_40%),
           radial-gradient(circle_at_80%_30%,rgba(34,211,238,0.25),transparent_40%),
           radial-gradient(circle_at_50%_80%,rgba(37,99,235,0.25),transparent_50%)]
          bg-gradient-to-br from-[#0B1120] via-[#111827] to-[#1E1B4B]"
      >
        <motion.main
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="max-w-6xl mx-auto space-y-20"
        >
          {/* ── Hero ── */}
          <section className="text-center">
            <motion.h1
              {...fadeUp(0)}
              className="text-5xl md:text-7xl font-extrabold mb-4 bg-gradient-to-r from-cyan-400 via-blue-400 to-violet-500 bg-clip-text text-transparent drop-shadow-xl"
            >
              About SwapSmith
            </motion.h1>
            <motion.p {...fadeUp(0.1)} className="text-gray-400 text-lg max-w-2xl mx-auto mb-10">
              The open-source AI-powered crypto terminal built by the community, for the community.
            </motion.p>

            {/* Repo Stats */}
            <motion.div {...fadeUp(0.2)} className="flex flex-wrap justify-center gap-4 mb-8">
              <StatBadge icon={<Star className="w-5 h-5" />}        label="Stars"        value={REPO_STATS.stars} />
              <StatBadge icon={<GitFork className="w-5 h-5" />}     label="Forks"        value={REPO_STATS.forks} />
              <StatBadge icon={<AlertCircle className="w-5 h-5" />} label="Open Issues"  value={REPO_STATS.openIssues} />
              <StatBadge icon={<Code2 className="w-5 h-5" />}       label="Language"     value={REPO_STATS.language} />
              <StatBadge icon={<Users className="w-5 h-5" />}       label="Contributors" value={CONTRIBUTORS.length} />
              <StatBadge icon={<Github className="w-5 h-5" />}      label="Total Commits" value={totalCommits} />
            </motion.div>

            {/* CTA Buttons */}
            <motion.div {...fadeUp(0.3)} className="flex flex-wrap justify-center gap-4">
              <a
                href="https://github.com/GauravKarakoti/SwapSmith"
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-white/10 border border-white/20 text-white font-semibold hover:bg-white/20 hover:border-cyan-400/50 transition-all duration-300"
              >
                <Github className="w-5 h-5" /> View on GitHub <ExternalLink className="w-4 h-4" />
              </a>
              <a
                href="https://github.com/GauravKarakoti/SwapSmith/issues"
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-violet-500/20 border border-violet-400/40 text-violet-300 font-semibold hover:bg-violet-500/30 transition-all duration-300"
              >
                <AlertCircle className="w-5 h-5" /> Open Issues
              </a>
              <a
                href="https://github.com/GauravKarakoti/SwapSmith/pulls"
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 font-semibold hover:bg-cyan-500/30 transition-all duration-300"
              >
                <Code2 className="w-5 h-5" /> Pull Requests
              </a>
            </motion.div>
          </section>

          {/* ── Features + Architecture ── */}
          <motion.section {...fadeUp(0.1)} className="grid md:grid-cols-2 gap-8">
            <GlassCard icon={<Sparkles size={22} />} title="Key Features">
              <FeatureList items={[
                'Real-time crypto price tracking and analytics',
                'Automated DCA (Dollar Cost Averaging) scheduler',
                'Integrated wallet connection via Wagmi & injected connectors',
                'Secure cross-chain swap functionality powered by SideShift',
                'AI-driven intent parsing with Groq (chat terminal)',
                'Voice command and live transcription support',
                'Yield scouting across protocols and chains',
                'On-chain rewards system with token mint on achievement',
                'Comprehensive notification and price-refresh cron jobs',
                'Modern, responsive Next.js 16 frontend with Tailwind v4',
              ]} />
            </GlassCard>

            <GlassCard icon={<Layers size={22} />} title="Architecture & Technologies">
              <FeatureList items={[
                'Frontend: Next.js 16, React 19, Tailwind CSS v4',
                'Bot Layer: Node.js Telegram bot with commander pattern',
                'Database: Drizzle ORM + PostgreSQL (Neon) + MongoDB',
                'Auth: Firebase Auth + Firebase Admin for SSR',
                'Web3: Wagmi v2 + viem for multi-chain support',
                'AI: Groq SDK for ultra-fast LLM inference',
                'DevOps: Docker Compose for local orchestration',
                'Caching: Custom hook-based stale-while-revalidate layer',
              ]} />
            </GlassCard>

            <GlassCard icon={<Shield size={22} />} title="Security & Privacy">
              <FeatureList items={[
                'No private keys ever stored — all signing done client-side',
                'Firebase Admin for secure server-side session management',
                'Environment-variable-gated secrets with runtime validation',
                'User data never sold or shared with third parties',
                'Rate-limited API routes to prevent abuse',
              ]} />
            </GlassCard>

            <GlassCard icon={<Rocket size={22} />} title="Our Mission">
              <p className="text-gray-300 leading-relaxed mb-4">
                SwapSmith was born from a simple idea: crypto should be accessible, transparent, and{' '}
                <span className="text-cyan-300 font-semibold">rewarding</span> for everyone — not just the technically elite.
              </p>
              <p className="text-gray-300 leading-relaxed">
                Whether you are a first-time DeFi user asking the AI terminal what DCA means, or a seasoned trader
                setting up cross-chain swaps, SwapSmith grows with you — and{' '}
                <span className="text-yellow-300 font-semibold">rewards you along the way.</span>
              </p>
            </GlassCard>
          </motion.section>

          {/* ── Rewards Section ── */}
          <motion.section {...fadeUp(0.15)}>
            <div className="flex items-center gap-4 mb-8">
              <div className="p-3 rounded-xl bg-gradient-to-r from-yellow-400 to-amber-500 text-white shadow-lg">
                <Trophy className="w-6 h-6" />
              </div>
              <h2 className="text-3xl font-bold text-white">How to Earn Rewards</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
              {REWARD_ACTIONS.map((action, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.07 }}
                  className="relative backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-5 hover:border-white/25 hover:shadow-[0_0_30px_rgba(34,211,238,0.12)] transition-all duration-300"
                >
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-r ${action.color} flex items-center justify-center text-white mb-3 shadow-md`}>
                    {action.icon}
                  </div>
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-white text-sm leading-snug">{action.label}</h3>
                    <span className={`text-xs font-bold bg-gradient-to-r ${action.color} bg-clip-text text-transparent whitespace-nowrap ml-2`}>
                      {action.points}
                    </span>
                  </div>
                  <p className="text-gray-400 text-xs leading-relaxed">{action.desc}</p>
                </motion.div>
              ))}
            </div>

            <div className="flex justify-center">
              <Link
                href="/rewards"
                className="inline-flex items-center gap-3 px-8 py-4 rounded-2xl bg-gradient-to-r from-yellow-400 via-amber-400 to-orange-500 text-black font-bold text-lg shadow-[0_0_40px_rgba(251,191,36,0.3)] hover:shadow-[0_0_60px_rgba(251,191,36,0.5)] hover:scale-105 transition-all duration-300"
              >
                <Trophy className="w-5 h-5" />
                Go to My Rewards Dashboard
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </motion.section>

          {/* ── GitHub Contributors ── */}
          <motion.section {...fadeUp(0.2)}>
            <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-gradient-to-r from-gray-600 to-gray-800 text-white shadow-lg border border-white/10">
                  <Github className="w-6 h-6" />
                </div>
                <h2 className="text-3xl font-bold text-white">Contributors</h2>
              </div>
              <a
                href="https://github.com/GauravKarakoti/SwapSmith/graphs/contributors"
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-gray-400 hover:text-cyan-300 transition-colors duration-200"
              >
                View all on GitHub <ExternalLink className="w-4 h-4" />
              </a>
            </div>

            {/* Contribution bar */}
            <div className="mb-8 rounded-2xl overflow-hidden border border-white/10 h-4 flex">
              {CONTRIBUTORS.slice(0, 8).map((c, i) => {
                const pct = totalCommits > 0 ? (c.contributions / totalCommits) * 100 : 0;
                const colors = ['bg-cyan-400','bg-violet-500','bg-blue-500','bg-pink-500','bg-green-500','bg-yellow-400','bg-orange-500','bg-indigo-400'];
                return (
                  <div
                    key={c.login}
                    className={`${colors[i]} transition-all duration-700`}
                    style={{ width: `${pct}%` }}
                    title={`${c.login}: ${c.contributions} commits (${pct.toFixed(1)}%)`}
                  />
                );
              })}
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4">
              {CONTRIBUTORS.map((c, i) => (
                <ContributorCard key={c.login} {...c} index={i} />
              ))}
            </div>

            <p className="text-center text-gray-500 text-sm mt-6">
              🤖 Also assisted by <span className="text-gray-400">Google Jules (AI)</span> &{' '}
              <span className="text-gray-400">Vercel Bot</span> — because automation is a contributor too.
            </p>
          </motion.section>

          {/* ── GitHub Repo Showcase ── */}
          <motion.section {...fadeUp(0.2)} className="grid md:grid-cols-3 gap-6">
            {[
              {
                href: 'https://github.com/GauravKarakoti/SwapSmith/issues',
                icon: <AlertCircle className="w-6 h-6" />,
                gradient: 'from-red-500 to-pink-500',
                label: 'Open Issues',
                value: REPO_STATS.openIssues,
                desc: 'Active discussions and bug reports — jump in and help!',
              },
              {
                href: 'https://github.com/GauravKarakoti/SwapSmith/network/members',
                icon: <GitFork className="w-6 h-6" />,
                gradient: 'from-blue-500 to-cyan-400',
                label: 'Forks',
                value: REPO_STATS.forks,
                desc: 'Community members running their own SwapSmith instances.',
              },
              {
                href: 'https://github.com/GauravKarakoti/SwapSmith/pulls',
                icon: <Code2 className="w-6 h-6" />,
                gradient: 'from-violet-500 to-purple-400',
                label: 'Pull Requests',
                value: 'Contribute',
                desc: 'Open a PR, fix a bug, ship a feature — all PRs welcome.',
              },
            ].map((card, i) => (
              <motion.a
                key={i}
                href={card.href}
                target="_blank" rel="noopener noreferrer"
                whileHover={{ y: -6, scale: 1.02 }}
                transition={{ type: 'spring', stiffness: 200 }}
                className="flex flex-col gap-3 p-6 rounded-2xl bg-white/5 border border-white/10 hover:border-white/25 transition-all duration-300 group"
              >
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-r ${card.gradient} flex items-center justify-center text-white shadow-md`}>
                  {card.icon}
                </div>
                <div className="text-3xl font-extrabold text-white">{card.value}</div>
                <div className="font-semibold text-white">{card.label}</div>
                <p className="text-gray-400 text-sm leading-relaxed">{card.desc}</p>
                <span className="text-xs text-cyan-400 group-hover:underline flex items-center gap-1">
                  View on GitHub <ExternalLink className="w-3 h-3" />
                </span>
              </motion.a>
            ))}
          </motion.section>

          {/* ── Contact & Contribution ── */}
          <motion.section {...fadeUp(0.25)}>
            <GlassCard>
              <div className="flex flex-col md:flex-row items-center gap-8">
                <div className="flex-1">
                  <h2 className="text-2xl font-semibold mb-3 text-white">Want to Contribute?</h2>
                  <p className="text-gray-300 leading-relaxed mb-4">
                    SwapSmith is fully open-source and warmly welcomes contributions of every kind — code, design,
                    documentation, or community support. Check our{' '}
                    <a
                      href="https://github.com/GauravKarakoti/SwapSmith/blob/main/CONTRIBUTING.md"
                      target="_blank" rel="noopener noreferrer"
                      className="text-violet-400 font-medium hover:text-cyan-300 underline underline-offset-2 transition-colors duration-200"
                    >
                      CONTRIBUTING.md
                    </a>{' '}
                    to get started.
                  </p>
                  <p className="text-gray-400 text-sm">
                    Every contribution — no matter how small — earns you a spot on the Contributors wall above. 🎉
                  </p>
                </div>
                <div className="flex flex-col gap-3 min-w-[200px]">
                  <a
                    href="https://github.com/GauravKarakoti/SwapSmith/fork"
                    target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-white/10 border border-white/20 text-white font-semibold hover:bg-white/20 transition-all duration-300"
                  >
                    <GitFork className="w-4 h-4" /> Fork the Repo
                  </a>
                  <a
                    href="https://github.com/GauravKarakoti/SwapSmith/issues/new"
                    target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-violet-500/20 border border-violet-400/40 text-violet-300 font-semibold hover:bg-violet-500/30 transition-all duration-300"
                  >
                    <AlertCircle className="w-4 h-4" /> Open an Issue
                  </a>
                  <Link
                    href="/rewards"
                    className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-yellow-400/20 border border-yellow-400/40 text-yellow-300 font-semibold hover:bg-yellow-400/30 transition-all duration-300"
                  >
                    <Trophy className="w-4 h-4" /> Earn Rewards
                  </Link>
                </div>
              </div>
            </GlassCard>
          </motion.section>

          {/* ── Rewards CTA Banner ── */}
          <motion.section
            {...fadeUp(0.3)}
            className="relative overflow-hidden rounded-3xl border border-yellow-400/30 bg-gradient-to-r from-yellow-500/10 via-amber-500/10 to-orange-500/10 p-10 text-center"
          >
            <div className="absolute inset-0 opacity-10 blur-3xl bg-gradient-to-r from-yellow-400 to-amber-500 pointer-events-none" />
            <Trophy className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
            <h2 className="text-3xl font-extrabold text-white mb-3">
              Start Earning SwapSmith Rewards Today
            </h2>
            <p className="text-gray-300 max-w-xl mx-auto mb-6">
              Every swap, every lesson learned, every daily login — they all add up to real on-chain tokens.
              Connect your wallet and start stacking points right now.
            </p>
            <Link
              href="/rewards"
              className="inline-flex items-center gap-3 px-10 py-4 rounded-2xl bg-gradient-to-r from-yellow-400 to-amber-500 text-black font-bold text-lg shadow-[0_0_40px_rgba(251,191,36,0.4)] hover:scale-105 hover:shadow-[0_0_60px_rgba(251,191,36,0.6)] transition-all duration-300"
            >
              <Trophy className="w-5 h-5" /> Go to Rewards <ArrowRight className="w-5 h-5" />
            </Link>
          </motion.section>

        </motion.main>
      </div>

      <Footer />
    </>
  );
}
