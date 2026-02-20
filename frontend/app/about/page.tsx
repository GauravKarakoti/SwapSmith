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
/*  Static Data                                                      */
/* ================================================================ */

const CONTRIBUTORS = [
  { login: 'GauravKarakoti', contributions: 242, avatar: 'https://avatars.githubusercontent.com/u/180496085?v=4' },
  { login: 'deekshithgowda85', contributions: 39, avatar: 'https://avatars.githubusercontent.com/u/152056807?v=4' },
  { login: 'Omkarop0808', contributions: 36, avatar: 'https://avatars.githubusercontent.com/u/194948962?v=4' },
  { login: 'Aditya8369', contributions: 28, avatar: 'https://avatars.githubusercontent.com/u/178887069?v=4' },
  { login: 'ayonpaul8906', contributions: 25, avatar: 'https://avatars.githubusercontent.com/u/179435490?v=4' },
  { login: 'navin-oss', contributions: 20, avatar: 'https://avatars.githubusercontent.com/u/181780004?v=4' },
];

const REPO_STATS = {
  stars: 3,
  forks: 22,
  openIssues: 54,
  language: 'TypeScript',
};

const REWARD_ACTIONS = [
  { icon: <Trophy className="w-5 h-5" />, label: 'Daily Login', points: '+10 pts', desc: 'Show up daily.' },
  { icon: <Zap className="w-5 h-5" />, label: 'Execute Swap', points: '+25 pts', desc: 'Swap any asset.' },
  { icon: <BookOpen className="w-5 h-5" />, label: 'Complete Course', points: '+50 pts', desc: 'Finish learning modules.' },
  { icon: <MessageSquare className="w-5 h-5" />, label: 'Use AI Terminal', points: '+15 pts', desc: 'Ask SwapSmith AI.' },
  { icon: <Wallet className="w-5 h-5" />, label: 'Connect Wallet', points: '+20 pts', desc: 'Unlock Web3 features.' },
  { icon: <Clock className="w-5 h-5" />, label: 'Setup DCA', points: '+30 pts', desc: 'Automate investments.' },
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
/*  Reusable Components                                              */
/* ================================================================ */

function GlassCard({
  children,
  title,
  icon,
}: {
  children: React.ReactNode;
  title?: string;
  icon?: React.ReactNode;
}) {
  return (
    <motion.div
      whileHover={{ y: -6 }}
      transition={{ type: 'spring', stiffness: 200 }}
      className="rounded-3xl p-8 bg-white/5 border border-white/10 backdrop-blur-xl hover:border-white/20"
    >
      {title && (
        <div className="flex items-center gap-3 mb-4">
          {icon && <div className="text-cyan-400">{icon}</div>}
          <h3 className="text-xl font-bold text-white">{title}</h3>
        </div>
      )}
      {children}
    </motion.div>
  );
}

function FeatureList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2 text-gray-300">
      {items.map((item, i) => (
        <li key={i} className="pl-4 relative before:absolute before:left-0 before:top-2 before:w-2 before:h-2 before:bg-cyan-400 before:rounded-full">
          {item}
        </li>
      ))}
    </ul>
  );
}

function ContributorCard({
  login,
  avatar,
  contributions,
}: {
  login: string;
  avatar: string;
  contributions: number;
}) {
  return (
    <a
      href={`https://github.com/${login}`}
      target="_blank"
      rel="noopener noreferrer"
      className="flex flex-col items-center gap-2 p-4 bg-white/5 border border-white/10 rounded-xl hover:border-cyan-400/40 transition"
    >
      <Image src={avatar} alt={login} width={48} height={48} className="rounded-full" unoptimized />
      <span className="text-sm text-white font-semibold">{login}</span>
      <span className="text-xs text-gray-400">{contributions} commits</span>
    </a>
  );
}

/* ================================================================ */
/*  Page                                                             */
/* ================================================================ */

export default function AboutPage() {
  const [totalCommits, setTotalCommits] = useState(0);

  useEffect(() => {
    setTotalCommits(CONTRIBUTORS.reduce((sum, c) => sum + c.contributions, 0));
  }, []);

  return (
    <>
      <Navbar />

      <div className="min-h-screen pt-32 pb-24 px-6 bg-gradient-to-br from-[#0B1120] via-[#111827] to-[#1E1B4B]">
        <motion.main {...fadeUp(0)} className="max-w-6xl mx-auto space-y-20">

          {/* Hero */}
          <section className="text-center">
            <h1 className="text-6xl font-extrabold bg-gradient-to-r from-cyan-400 to-violet-500 bg-clip-text text-transparent">
              About SwapSmith
            </h1>
            <p className="text-gray-400 mt-4 max-w-2xl mx-auto">
              Open-source AI-powered crypto terminal built by the community.
            </p>
          </section>

          {/* Stats */}
          <section className="grid grid-cols-2 md:grid-cols-6 gap-4">
            <GlassCard title="Stars" icon={<Star />}>{REPO_STATS.stars}</GlassCard>
            <GlassCard title="Forks" icon={<GitFork />}>{REPO_STATS.forks}</GlassCard>
            <GlassCard title="Issues" icon={<AlertCircle />}>{REPO_STATS.openIssues}</GlassCard>
            <GlassCard title="Lang" icon={<Code2 />}>{REPO_STATS.language}</GlassCard>
            <GlassCard title="Contributors" icon={<Users />}>{CONTRIBUTORS.length}</GlassCard>
            <GlassCard title="Commits" icon={<Github />}>{totalCommits}</GlassCard>
          </section>

          {/* Features */}
          <section className="grid md:grid-cols-2 gap-6">
            <GlassCard title="Key Features" icon={<Sparkles />}>
              <FeatureList items={[
                'AI-powered crypto terminal',
                'Cross-chain swaps',
                'Automated DCA',
                'Wallet-based security',
              ]} />
            </GlassCard>

            <GlassCard title="Architecture" icon={<Layers />}>
              <FeatureList items={[
                'Next.js + Tailwind',
                'Wagmi + Viem',
                'Groq AI',
                'Firebase Auth',
              ]} />
            </GlassCard>
          </section>

          {/* Contributors */}
          <section>
            <h2 className="text-3xl font-bold text-white mb-6">Contributors</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
              {CONTRIBUTORS.map(c => (
                <ContributorCard key={c.login} {...c} />
              ))}
            </div>
          </section>

        </motion.main>
      </div>

      <Footer />
    </>
  );
}