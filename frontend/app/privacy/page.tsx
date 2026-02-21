"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  Shield,
  Database,
  Lock,
  UserCheck,
  RefreshCcw,
} from "lucide-react";

// Generate particle positions once
const generateParticles = () => 
  [...Array(25)].map(() => ({
    initialX: Math.random() * 1200,
    initialY: Math.random() * 800,
    animateY: Math.random() * 800,
    animateX: Math.random() * 1200,
    duration: 20 + Math.random() * 20,
  }));

const sections = [
  {
    title: "1. Data Collection",
    icon: Database,
    content: [
      "We collect minimal personal information required for account creation (e.g., email address).",
      "Blockchain wallet addresses are used for authentication and transactions.",
      "We never store private keys or sensitive financial information.",
    ],
  },
  {
    title: "2. Data Usage",
    icon: UserCheck,
    content: [
      "Your data is used strictly to provide and improve SwapSmith services.",
      "We never sell or share personal information.",
      "Anonymous analytics may be used for platform enhancement.",
    ],
  },
  {
    title: "3. Security",
    icon: Lock,
    content: [
      "Industry-standard encryption protects all communications.",
      "Infrastructure follows modern Web3 security best practices.",
    ],
  },
  {
    title: "4. User Rights",
    icon: Shield,
    content: [
      "You may request deletion of your account anytime.",
      "Contact support for privacy-related concerns.",
    ],
  },
  {
    title: "5. Updates",
    icon: RefreshCcw,
    content: [
      "This policy may be updated periodically.",
      "Changes will be communicated via the platform.",
    ],
  },
];

export default function Privacy() {
  const [particles] = useState(generateParticles);

  return (
    <div className="relative min-h-screen overflow-hidden 
    bg-linear-to-br from-background via-background to-muted/40
    text-foreground px-6 py-24">

      {/* Back Button */}
      <div className="max-w-5xl mx-auto mb-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 hover:bg-indigo-500/80 text-indigo-500 hover:text-white font-semibold shadow transition-colors duration-200 border border-indigo-200/30"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Back to Home
        </Link>
      </div>

      {/* Floating Animated Particles */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        {particles.map((particle, i) => (
          <motion.div
            key={i}
            className="absolute w-2 h-2 bg-indigo-500/30 rounded-full blur-sm"
            initial={{
              x: particle.initialX,
              y: particle.initialY,
            }}
            animate={{
              y: [null, particle.animateY],
              x: [null, particle.animateX],
            }}
            transition={{
              duration: particle.duration,
              repeat: Infinity,
              repeatType: "reverse",
            }}
          />
        ))}
      </div>

      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="text-center mb-20">
          <h1 className="text-5xl font-extrabold tracking-tight 
          bg-linear-to-r from-indigo-500 via-purple-500 to-cyan-400
          bg-clip-text text-transparent">
            Privacy Policy
          </h1>

          <p className="mt-6 text-muted-foreground max-w-2xl mx-auto text-lg">
            Your privacy is fundamental to SwapSmith. We combine Web3 principles,
            transparency, and strong encryption to protect your digital identity.
          </p>
        </div>

        {/* Policy Cards */}
        <div className="grid md:grid-cols-2 gap-10">
          {sections.map((section, index) => {
            const Icon = section.icon;

            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="group relative rounded-3xl p-8 
                bg-white/5 dark:bg-white/5 
                backdrop-blur-xl 
                border border-white/10 
                hover:border-indigo-500/50 
                transition-all duration-500 
                shadow-lg hover:shadow-indigo-500/20"
              >
                {/* Neon Hover Glow */}
                <div className="absolute inset-0 rounded-3xl opacity-0 
                group-hover:opacity-100 transition duration-500 
                bg-linear-to-r from-indigo-500/10 via-purple-500/10 to-cyan-400/10 blur-xl -z-10" />

                {/* Icon */}
                <div className="flex items-center gap-4 mb-6">
                  <div className="p-3 rounded-xl 
                  bg-linear-to-br from-indigo-500/20 to-purple-500/20
                  group-hover:scale-110 transition duration-300">
                    <Icon className="text-indigo-400 w-6 h-6" />
                  </div>
                  <h2 className="text-xl font-semibold">
                    {section.title}
                  </h2>
                </div>

                {/* Content */}
                <ul className="space-y-3 text-muted-foreground">
                  {section.content.map((item, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-indigo-400 mt-1">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="text-center mt-20">
          <span className="inline-block px-4 py-2 rounded-full bg-linear-to-r from-indigo-500 via-purple-500 to-cyan-400 text-white font-semibold shadow-lg animate-pulse">
            Last updated: February 17, 2026
          </span>
        </div>
      </div>
    </div>
  );
}
