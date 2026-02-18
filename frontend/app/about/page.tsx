'use client';

import React from 'react';
import { motion } from 'framer-motion';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Shield, Rocket, Layers, Sparkles } from 'lucide-react';

/* ============================= */

interface GlassCardProps {
  children: React.ReactNode;
  title?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}

interface FeatureListProps {
  items: string[];
}

export default function AboutPage() {
  return (
    <>
      <Navbar />

      <div className="relative min-h-screen overflow-hidden bg-primary pt-32 pb-24 px-6 transition-colors duration-500">
        {/* Ambient Background Glows - Theme Aware */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-[10%] left-[10%] w-[40%] h-[40%] rounded-full bg-ambient-purple blur-[120px] opacity-50" />
            <div className="absolute top-[20%] right-[10%] w-[30%] h-[30%] rounded-full bg-ambient-cyan blur-[120px] opacity-30" />
            <div className="absolute bottom-[10%] left-[30%] w-[40%] h-[40%] rounded-full bg-ambient-blue blur-[120px] opacity-20" />
        </div>

        <motion.main
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="relative z-10 max-w-5xl mx-auto"
        >
          {/* Page Title - Uses Gradient Text Utility */}
          <h1 className="text-5xl md:text-6xl font-extrabold mb-12 text-center gradient-text drop-shadow-xl">
            About SwapSmith
          </h1>

          {/* Grid Sections */}
          <div className="grid md:grid-cols-2 gap-12">
            <GlassCard icon={<Sparkles size={22} />} title="Key Features">
              <FeatureList
                items={[
                  "Real-time crypto price tracking and analytics",
                  "Automated DCA (Dollar Cost Averaging) scheduler",
                  "Integrated wallet connection and management",
                  "Secure and fast swap functionality",
                  "Contextual help and user guidance",
                  "Notifications and yield tracking",
                  "Voice command and transcription support",
                  "Modern, responsive frontend with Next.js",
                ]}
              />
            </GlassCard>

            <GlassCard icon={<Layers size={22} />} title="Architecture & Technologies">
              <FeatureList
                items={[
                  "Frontend: Next.js, React, Tailwind CSS",
                  "Backend: Node.js services for trading logic",
                  "Database: Drizzle ORM and SQL",
                  "APIs: Blockchain explorers and price feeds",
                  "Dockerized deployment for scalability",
                ]}
              />
            </GlassCard>

            <GlassCard icon={<Shield size={22} />} title="Security & Privacy">
              <FeatureList
                items={[
                  "Secure operations using industry best practices",
                  "User data never shared with third parties",
                  "Wallet connections never store private keys",
                ]}
              />
            </GlassCard>

            <GlassCard icon={<Rocket size={22} />} title="Our Mission">
              <p className="text-secondary leading-relaxed">
                Our mission is to make crypto trading accessible, transparent,
                and rewarding for everyone. Whether you are a beginner or an
                experienced trader, SwapSmith provides the tools and support
                you need to succeed in the evolving world of digital assets.
              </p>
            </GlassCard>
          </div>

          {/* Contact Section */}
          <GlassCard className="mt-16">
            <h2 className="text-2xl font-semibold mb-4 text-primary">
              Contact & Contribution
            </h2>
            <p className="text-secondary leading-relaxed">
              SwapSmith is open source and welcomes contributions! For
              questions, suggestions, or to get involved, please see our{" "}
              <a
                href="/CONTRIBUTING.md"
                className="relative text-violet-500 dark:text-violet-400 font-medium group transition-all duration-300 hover:text-cyan-500"
              >
                contribution guidelines
                <span className="absolute left-0 -bottom-1 w-0 h-[2px] bg-gradient-to-r from-violet-400 to-cyan-400 transition-all duration-300 group-hover:w-full"></span>
              </a>{" "}
              or contact the team via the project repository.
            </p>
          </GlassCard>
        </motion.main>
      </div>

      <Footer />
    </>
  );
}

function GlassCard({ children, title, icon, className = "" }: GlassCardProps) {
  return (
    <motion.div
      whileHover={{ y: -8 }}
      transition={{ type: "spring", stiffness: 200 }}
      className={`relative backdrop-blur-xl bg-white/40 dark:bg-white/5 
        border border-primary rounded-3xl p-8 shadow-xl
        hover:shadow-[0_0_40px_rgba(var(--ambient-cyan)/0.2)]
        transition-all duration-500 ${className}`}
    >
      {title && (
        <div className="flex items-center gap-4 mb-6">
          {icon && (
            <div className="p-3 rounded-xl btn-primary text-white shadow-lg">
              {icon}
            </div>
          )}
          <h2 className="text-2xl font-bold text-primary tracking-wide">
            {title}
          </h2>
        </div>
      )}
      {children}
    </motion.div>
  );
}

function FeatureList({ items }: FeatureListProps) {
  return (
    <ul className="space-y-3">
      {items.map((item, index) => (
        <li
          key={index}
          className="relative pl-6 text-secondary hover:text-primary transition-all duration-300
            before:absolute before:left-0 before:top-2
            before:w-2.5 before:h-2.5 before:rounded-full
            before:bg-gradient-to-r before:from-violet-400 before:to-cyan-400"
        >
          {item}
        </li>
      ))}
    </ul>
  );
}