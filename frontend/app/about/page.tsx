'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import {
  Layers,
  Sparkles,
  Trophy,
  Star,
  GitFork,
  AlertCircle,
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

const REPO_STATS = {
  stars: 3,
  forks: 22,
  openIssues: 54,
  language: 'TypeScript',
};

// ...existing code...

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

/* ================================================================ */
/*  Page                                                             */
/* ================================================================ */

export default function AboutPage() {
  const [totalCommits, setTotalCommits] = useState(0);

  useEffect(() => {
    setTotalCommits(390); // approximate total
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
          <section className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <GlassCard title="Stars" icon={<Star />}>{REPO_STATS.stars}</GlassCard>
            <GlassCard title="Forks" icon={<GitFork />}>{REPO_STATS.forks}</GlassCard>
            <GlassCard title="Issues" icon={<AlertCircle />}>{REPO_STATS.openIssues}</GlassCard>
            <GlassCard title="Lang" icon={<Code2 />}>{REPO_STATS.language}</GlassCard>
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

          {/* Contributors Link */}
          <section className="text-center">
            <Link
              href="/contributors"
              className="inline-flex items-center gap-3 px-8 py-4 bg-white/5 border border-white/10 rounded-2xl hover:border-cyan-400/40 transition group"
            >
              <Users className="w-5 h-5 text-cyan-400" />
              <span className="text-white font-bold">View All Contributors</span>
              <ArrowRight className="w-4 h-4 text-gray-400 group-hover:translate-x-1 transition-transform" />
            </Link>
          </section>

        </motion.main>
      </div>

      <Footer />
    </>
  );
}