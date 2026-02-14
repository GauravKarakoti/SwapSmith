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


/*         About Page            */


export default function AboutPage() {
  return (
    <>
      <Navbar />

      <div
        className="relative min-h-screen overflow-hidden 
        bg-[radial-gradient(circle_at_20%_20%,rgba(124,58,237,0.35),transparent_40%),
        radial-gradient(circle_at_80%_30%,rgba(34,211,238,0.25),transparent_40%),
        radial-gradient(circle_at_50%_80%,rgba(37,99,235,0.25),transparent_50%)]
        bg-gradient-to-br from-[#0B1120] via-[#111827] to-[#1E1B4B]
        pt-32 pb-24 px-6"
      >
        <motion.main
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="max-w-5xl mx-auto"
        >
          {/* Page Title */}
          <h1
            className="text-5xl md:text-6xl font-extrabold mb-12 text-center
            bg-gradient-to-r from-cyan-400 via-blue-500 to-violet-500
            bg-clip-text text-transparent drop-shadow-xl"
          >
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
              <p className="text-gray-300 leading-relaxed">
                Our mission is to make crypto trading accessible, transparent,
                and rewarding for everyone. Whether you are a beginner or an
                experienced trader, SwapSmith provides the tools and support
                you need to succeed in the evolving world of digital assets.
              </p>
            </GlassCard>
          </div>

          {/* Contact Section */}
          <GlassCard className="mt-16">
            <h2 className="text-2xl font-semibold mb-4 text-white">
              Contact & Contribution
            </h2>
            <p className="text-gray-300 leading-relaxed">
              SwapSmith is open source and welcomes contributions! For
              questions, suggestions, or to get involved, please see our{" "}
              <a
                href="/CONTRIBUTING.md"
                className="relative text-violet-400 font-medium group transition-all duration-300 hover:text-cyan-300"
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


/*        Glass Card             */


function GlassCard({
  children,
  title,
  icon,
  className = "",
}: GlassCardProps) {
  return (
    <motion.div
      whileHover={{ y: -8 }}
      transition={{ type: "spring", stiffness: 200 }}
      className={`relative backdrop-blur-xl 
        bg-gradient-to-br from-white/10 via-white/5 to-transparent
        border border-white/15
        rounded-3xl p-8 shadow-xl
        hover:shadow-[0_0_60px_rgba(34,211,238,0.35)]
        transition-all duration-500 ${className}`}
    >
      {title && (
        <div className="flex items-center gap-4 mb-6">
          {icon && (
            <div className="p-3 rounded-xl bg-gradient-to-r from-cyan-400 via-blue-500 to-violet-500 text-white shadow-lg">
              {icon}
            </div>
          )}
          <h2 className="text-2xl font-bold text-white tracking-wide">
            {title}
          </h2>
        </div>
      )}
      {children}
    </motion.div>
  );
}


/*        Feature List           */


function FeatureList({ items }: FeatureListProps) {
  return (
    <ul className="space-y-3">
      {items.map((item, index) => (
        <li
          key={index}
          className="relative pl-6 text-gray-300 hover:text-white transition-all duration-300
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
