'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import {
  Layers,
  Sparkles,
  Star,
  GitFork,
  AlertCircle,
  Github,
  Code2,
  Users,
} from 'lucide-react';

/* ================================================================ */
/* Static Data                                                     */
/* ================================================================ */

const REPO_STATS = [
  { label: "Stars", value: "3", icon: Star, color: "text-amber-500" },
  { label: "Forks", value: "22", icon: GitFork, color: "text-blue-500" },
  { label: "Issues", value: "54", icon: AlertCircle, color: "text-red-500" },
  { label: "Lang", value: "TS", icon: Code2, color: "text-indigo-500" },
];

/* ================================================================ */
/* Reusable Components                                             */
/* ================================================================ */

function GlassCard({
  children,
  title,
  icon: Icon,
  className = "",
}: {
  children: React.ReactNode;
  title?: string;
  icon?: React.ElementType;
  className?: string;
}) {
  return (
    <motion.div
      whileHover={{ y: -6 }}
      className={`glow-card rounded-[2.5rem] p-8 border-primary transition-all duration-500 ${className}`}
    >
      {title && (
        <div className="flex items-center gap-4 mb-6">
          {Icon && (
            <div className="p-3 bg-secondary rounded-2xl border border-primary">
              <Icon className="w-5 h-5 text-accent-primary" />
            </div>
          )}
          <h3 className="text-xl font-black text-primary tracking-tighter">{title}</h3>
        </div>
      )}
      {children}
    </motion.div>
  );
}

function FeatureList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-4">
      {items.map((item, i) => (
        <li key={i} className="flex items-center gap-3 group">
          <div className="w-2 h-2 rounded-full bg-accent-primary group-hover:scale-150 transition-transform" />
          <span className="text-secondary font-medium text-sm group-hover:text-primary transition-colors">
            {item}
          </span>
        </li>
      ))}
    </ul>
  );
}

/* ================================================================ */
/* Page Component                                                  */
/* ================================================================ */

export default function AboutPage() {
  const [totalCommits, setTotalCommits] = useState(0);

  useEffect(() => {
    setTotalCommits(390); 
  }, []);

  return (
    <>
      <Navbar />

      <div className="min-h-screen bg-primary pt-32 pb-24 px-6 transition-colors duration-500 relative overflow-hidden">
        
        {/* Background Ambient Glows */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-ambient-purple blur-[120px] opacity-20" />
          <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-ambient-cyan blur-[120px] opacity-10" />
        </div>

        <motion.main 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-6xl mx-auto space-y-16 relative z-10"
        >
          {/* Hero Section */}
          <section className="text-center space-y-6">
            <h1 className="text-5xl md:text-7xl font-black tracking-tighter text-primary">
              Forging the <span className="gradient-text">Future</span> of Trading
            </h1>
            <p className="text-secondary text-lg font-medium max-w-2xl mx-auto leading-relaxed">
              SwapSmith is an open-source, AI-augmented terminal designed to bridge the gap between complex blockchain protocols and everyday liquidity.
            </p>
          </section>

          {/* Repository Health Stats */}
          <section className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {REPO_STATS.map((stat, i) => (
              <div key={i} className="glass rounded-3xl p-6 border-primary flex flex-col items-center text-center group hover:bg-section-hover transition-colors">
                <stat.icon className={`w-6 h-6 mb-3 ${stat.color}`} />
                <div className="text-2xl font-black text-primary tracking-tighter">{stat.value}</div>
                <div className="text-[10px] font-black uppercase tracking-widest text-muted">{stat.label}</div>
              </div>
            ))}
            <div className="glass rounded-3xl p-6 border-primary flex flex-col items-center text-center group bg-indigo-500/5">
              <Github className="w-6 h-6 mb-3 text-primary" />
              <div className="text-2xl font-black text-primary tracking-tighter">{totalCommits}</div>
              <div className="text-[10px] font-black uppercase tracking-widest text-muted">Commits</div>
            </div>
          </section>

          {/* Features & Architecture */}
          <section className="grid md:grid-cols-2 gap-8">
            <GlassCard title="Terminal Capabilities" icon={Sparkles}>
              <FeatureList items={[
                'Groq-Powered Natural Language Execution',
                'Cross-Chain Atomic Swap Integration',
                'Precision DCA Investment Scheduling',
                'Non-Custodial Wallet Architecture',
                'Biometric & Hardware Signer Support',
              ]} />
            </GlassCard>

            <GlassCard title="Technical Stack" icon={Layers}>
              <FeatureList items={[
                'Next.js 14 (App Router) & Framer Motion',
                'Wagmi / Viem Web3 Middleware',
                'Tailwind CSS Design System',
                'Firebase Distributed Database',
                'Industrial Grade Price Feeds',
              ]} />
            </GlassCard>
          </section>

          {/* Open Source Call to Action */}
          <section className="text-center">
            <div className="p-10 glass rounded-[3rem] border-primary border-dashed relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-accent-primary via-accent-tertiary to-accent-primary opacity-50" />
              <Users className="w-12 h-12 text-accent-primary mx-auto mb-6" />
              <h2 className="text-3xl font-black text-primary tracking-tighter mb-4">Built by 20+ Global Contributors</h2>
              <p className="text-secondary mb-8 max-w-xl mx-auto font-medium">
                SwapSmith is 100% community-owned. Our code is peer-reviewed, audited, and open for anyone to improve.
              </p>
              
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link
                  href="/contributors"
                  className="btn-primary flex items-center gap-3 px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-sm shadow-xl shadow-blue-500/20 active:scale-95 transition-all"
                >
                  <Users className="w-5 h-5" />
                  Explore Contributors
                </Link>
                <a
                  href="https://github.com/GauravKarakoti/SwapSmith"
                  target="_blank"
                  className="flex items-center gap-3 px-8 py-4 rounded-2xl bg-secondary border border-primary text-primary font-black uppercase tracking-widest text-sm hover:bg-section-hover transition-all"
                >
                  <Github className="w-5 h-5" />
                  View Source Code
                </a>
              </div>
            </div>
          </section>

        </motion.main>
      </div>

      <Footer />
    </>
  );
}