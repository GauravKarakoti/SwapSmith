'use client'

import { useRouter } from 'next/navigation'
import { motion, useMotionValue, useSpring } from 'framer-motion'
import { Zap, Mic, Shield, ArrowRight, Wallet, MessageSquare, CheckCircle, ListChecks, BarChart3, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth' 

// Floating particles component
const FloatingParticle = ({ delay, duration, x, y }: { delay: number; duration: number; x: number; y: number }) => (
  <motion.div
    className="absolute w-1 h-1 bg-gradient-to-r from-cyan-400 to-purple-500 rounded-full"
    style={{ left: `${x}%`, top: `${y}%` }}
    animate={{
      y: [-20, 20, -20],
      x: [-10, 10, -10],
      opacity: [0.2, 0.8, 0.2],
      scale: [1, 1.5, 1],
    }}
    transition={{
      duration,
      delay,
      repeat: Infinity,
      ease: "easeInOut",
    }}
  />
)

// Magnetic button component
const MagneticButton = ({ children, onClick, className }: { children: React.ReactNode; onClick: () => void; className?: string }) => {
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const springX = useSpring(x, { stiffness: 300, damping: 20 })
  const springY = useSpring(y, { stiffness: 300, damping: 20 })

  const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    x.set((e.clientX - centerX) * 0.15)
    y.set((e.clientY - centerY) * 0.15)
  }

  const handleMouseLeave = () => {
    x.set(0)
    y.set(0)
  }

  return (
    <motion.button
      onClick={onClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ x: springX, y: springY }}
      className={className}
      whileTap={{ scale: 0.95 }}
    >
      {children}
    </motion.button>
  )
}

// Glowing card component
const GlowCard = ({ children, className, glowColor = "cyan" }: { children: React.ReactNode; className?: string; glowColor?: string }) => {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })
  const [isHovered, setIsHovered] = useState(false)

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setMousePosition({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    })
  }

  const glowColors: Record<string, string> = {
    cyan: "rgba(34, 211, 238, 0.15)",
    purple: "rgba(168, 85, 247, 0.15)",
    pink: "rgba(236, 72, 153, 0.15)",
    emerald: "rgba(52, 211, 153, 0.15)",
    orange: "rgba(251, 146, 60, 0.15)",
    blue: "rgba(59, 130, 246, 0.15)",
  }

  return (
    <motion.div
      className={`relative overflow-hidden ${className}`}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      whileHover={{ y: -8, scale: 1.02 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      {isHovered && (
        <motion.div
          className="absolute pointer-events-none w-[300px] h-[300px] rounded-full blur-[80px]"
          style={{
            background: glowColors[glowColor] || glowColors.cyan,
            left: mousePosition.x - 150,
            top: mousePosition.y - 150,
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        />
      )}
      {children}
    </motion.div>
  )
}

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: [0.25, 0.46, 0.45, 0.94] as const,
    },
  },
}

const slideInLeft = {
  hidden: { opacity: 0, x: -60 },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.7,
      ease: [0.25, 0.46, 0.45, 0.94] as const,
    },
  },
}

export default function LandingPage() {
  const router = useRouter()
  const { isAuthenticated } = useAuth()
  const [particles] = useState(() =>
    Array.from({ length: 30 }, (_, i) => ({
      id: i,
      delay: Math.random() * 3,
      duration: 4 + Math.random() * 4,
      x: Math.random() * 100,
      y: Math.random() * 100,
    }))
  )
  
  const handleAccess = () => {
    if (isAuthenticated) {
      router.push('/terminal')
    } else {
      router.push('/login')
    }
  }

  const features = [
    { icon: MessageSquare, title: "Natural Language", desc: "Describe the swap you want in plain English. No complex forms required.", color: "cyan" },
    { icon: Zap, title: "Cross-Chain Magic", desc: "Seamlessly swap between 200+ assets across 40+ chains using SideShift.ai API.", color: "purple" },
    { icon: Mic, title: "Voice Input", desc: "Experimental voice integration allows you to command the agent hands-free.", color: "pink" },
    { icon: Shield, title: "Self-Custodial", desc: "Your keys stay yours. Transactions are only executed after your explicit confirmation.", color: "emerald" },
    { icon: BarChart3, title: "Real-Time Quotes", desc: "Always get the best available rate via SideShift integration.", color: "orange" },
  ]

  const steps = [
    { step: 1, text: "Connect Your Wallet (e.g., MetaMask).", icon: Wallet },
    { step: 2, text: "Type or Speak your swap command into the chat.", icon: Mic },
    { step: 3, text: "Review the parsed intent and the live quote provided by SideShift.", icon: ListChecks },
    { step: 4, text: "Confirm the transaction directly in your wallet.", icon: CheckCircle },
    { step: 5, text: "Relax while SwapSmith handles the logic in the background.", icon: Zap },
  ]

  return (
    <div className="min-h-screen bg-[#030308] text-white selection:bg-cyan-500/30 font-sans overflow-x-hidden">
      {/* Animated background gradient */}
      <div className="fixed inset-0 pointer-events-none">
        <motion.div
          className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-gradient-to-r from-cyan-500/10 via-purple-500/10 to-pink-500/10 rounded-full blur-[150px]"
          animate={{
            x: [0, 100, 0],
            y: [0, 50, 0],
            scale: [1, 1.2, 1],
          }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-cyan-500/10 rounded-full blur-[150px]"
          animate={{
            x: [0, -80, 0],
            y: [0, -60, 0],
            scale: [1.2, 1, 1.2],
          }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        />
        {/* Floating particles */}
        {particles.map((p) => (
          <FloatingParticle key={p.id} {...p} />
        ))}
      </div>

      {/* Grid overlay */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.02]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: '60px 60px',
        }}
      />

      {/* 1. Sleek Navbar */}
      <motion.nav
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="fixed top-0 w-full z-50 border-b border-white/5 bg-[#030308]/70 backdrop-blur-xl"
      >
        <div className="max-w-7xl mx-auto px-6 h-20 flex justify-between items-center">
          <motion.div
            className="flex items-center gap-2 cursor-pointer"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <motion.div
              animate={{ rotate: [0, 360] }}
              transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
            >
              <Zap className="w-7 h-7 text-cyan-400" fill="currentColor" />
            </motion.div>
            <span className="text-xl font-black tracking-tighter uppercase bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              SwapSmith
            </span>
          </motion.div>
          <MagneticButton
            onClick={handleAccess}
            className="group flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-purple-600 text-white px-6 py-2.5 rounded-full text-xs font-bold uppercase tracking-widest hover:shadow-[0_0_30px_rgba(34,211,238,0.4)] transition-all duration-300"
          >
            Launch App <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </MagneticButton>
        </div>
      </motion.nav>

      {/* 2. Hero Section */}
      <section className="relative pt-40 pb-24 px-6 overflow-hidden">
        <motion.div
          className="max-w-5xl mx-auto text-center space-y-10 relative z-10"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <motion.div variants={itemVariants} className="flex justify-center">
            <motion.div
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500/10 to-purple-500/10 border border-cyan-500/20 rounded-full"
              animate={{ boxShadow: ["0 0 20px rgba(34,211,238,0.1)", "0 0 40px rgba(34,211,238,0.2)", "0 0 20px rgba(34,211,238,0.1)"] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <Sparkles className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-semibold text-cyan-300 tracking-wider uppercase">AI-Powered Trading</span>
            </motion.div>
          </motion.div>

          <motion.h1
            variants={itemVariants}
            className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tighter leading-[0.9]"
          >
            <span className="bg-gradient-to-b from-white via-white to-white/30 bg-clip-text text-transparent">
              YOUR VOICE-ACTIVATED
            </span>
            <br />
            <motion.span
              className="bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent"
              animate={{
                backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
              }}
              transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
              style={{ backgroundSize: "200% 200%" }}
            >
              TRADING ASSISTANT.
            </motion.span>
          </motion.h1>
          <div className="bg-white/5 border border-white/10 p-4 rounded-2xl max-w-md mx-auto italic text-zinc-400 text-sm md:text-base">
            &ldquo;Swap half of my MATIC on Polygon for 50 USDC on Arbitrum.&rdquo;
          </div>

          <motion.p
            variants={itemVariants}
            className="text-lg md:text-xl lg:text-2xl text-zinc-400 max-w-2xl mx-auto font-medium"
          >
            Execute complex, cross-chain cryptocurrency swaps using{" "}
            <span className="text-cyan-400">simple natural language</span>.
          </motion.p>

          <motion.div
            variants={itemVariants}
            className="relative group max-w-lg mx-auto"
          >
            <motion.div
              className="absolute -inset-1 bg-gradient-to-r from-cyan-500/20 via-purple-500/20 to-pink-500/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
            />
            <div className="relative bg-white/5 border border-white/10 p-5 rounded-2xl backdrop-blur-sm">
              <div className="flex items-center gap-2 mb-2">
                <motion.div
                  className="w-2 h-2 rounded-full bg-cyan-400"
                  animate={{ scale: [1, 1.3, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
                <span className="text-xs text-zinc-500 uppercase tracking-wider">Voice Command</span>
              </div>
              <p className="italic text-zinc-300 text-base md:text-lg">
                "Swap half of my MATIC on Polygon for 50 USDC on Arbitrum."
              </p>
            </div>
          </motion.div>

          <motion.div variants={itemVariants} className="pt-4">
            <MagneticButton
              onClick={handleAccess}
              className="group relative px-12 py-5 bg-gradient-to-r from-cyan-500 via-purple-600 to-pink-600 rounded-2xl font-black text-xl overflow-hidden"
            >
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500"
                animate={{
                  x: ["-100%", "100%"],
                }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                style={{ opacity: 0.3 }}
              />
              <span className="relative flex items-center gap-2">
                Start Trading Now
                <motion.span
                  animate={{ x: [0, 5, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  <ArrowRight className="w-5 h-5" />
                </motion.span>
              </span>
            </MagneticButton>
          </motion.div>

          {/* Floating stats */}
          <motion.div
            variants={itemVariants}
            className="flex flex-wrap justify-center gap-8 pt-8"
          >
            {[
              { value: "200+", label: "Assets" },
              { value: "40+", label: "Chains" },
              { value: "0%", label: "Platform Fees" },
            ].map((stat, i) => (
              <motion.div
                key={i}
                className="text-center"
                whileHover={{ y: -5 }}
              >
                <div className="text-3xl font-black bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
                  {stat.value}
                </div>
                <div className="text-xs text-zinc-500 uppercase tracking-wider">{stat.label}</div>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      </section>

      {/* 3. Features Grid */}
      <section className="relative max-w-6xl mx-auto px-6 py-24">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-4xl md:text-5xl font-black tracking-tighter mb-4">
            <span className="bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">POWERFUL</span> FEATURES
          </h2>
          <p className="text-zinc-500 max-w-md mx-auto">Everything you need for seamless cross-chain trading</p>
        </motion.div>

        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          {features.map((feature, idx) => (
            <motion.div key={idx} variants={itemVariants}>
              <GlowCard
                className="h-full p-8 bg-white/[0.02] border border-white/5 rounded-3xl backdrop-blur-sm"
                glowColor={feature.color}
              >
                <div className="relative z-10 space-y-4">
                  <motion.div
                    className={`w-14 h-14 rounded-2xl bg-gradient-to-br from-${feature.color}-500/20 to-${feature.color}-600/10 flex items-center justify-center`}
                    whileHover={{ rotate: [0, -10, 10, 0] }}
                    transition={{ duration: 0.5 }}
                  >
                    <feature.icon className={`w-7 h-7 text-${feature.color}-400`} style={{ color: feature.color === 'cyan' ? '#22d3ee' : feature.color === 'purple' ? '#a855f7' : feature.color === 'pink' ? '#ec4899' : feature.color === 'emerald' ? '#34d399' : '#fb923c' }} />
                  </motion.div>
                  <h3 className="text-xl font-bold text-white">{feature.title}</h3>
                  <p className="text-zinc-500 text-sm leading-relaxed">{feature.desc}</p>
                </div>
              </GlowCard>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* 4. How it Works */}
      <section className="relative max-w-4xl mx-auto px-6 py-24">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-4xl md:text-5xl font-black tracking-tighter">
            HOW IT <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">WORKS</span>
          </h2>
        </motion.div>

        <motion.div
          className="space-y-4"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          {steps.map((item, idx) => (
            <motion.div
              key={idx}
              variants={slideInLeft}
              custom={idx}
              className="group relative"
            >
              <motion.div
                className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500/0 via-purple-500/0 to-pink-500/0 rounded-2xl opacity-0 group-hover:opacity-100 group-hover:from-cyan-500/20 group-hover:via-purple-500/20 group-hover:to-pink-500/20 transition-all duration-500 blur-sm"
              />
              <div className="relative flex items-center gap-6 p-6 bg-white/[0.02] border border-white/5 rounded-2xl group-hover:border-cyan-500/30 group-hover:bg-white/[0.04] transition-all duration-300">
                <motion.div
                  className="text-3xl font-black text-transparent bg-gradient-to-b from-white/10 to-white/5 bg-clip-text group-hover:from-cyan-400 group-hover:to-purple-400 transition-all duration-300"
                  whileHover={{ scale: 1.1 }}
                >
                  0{item.step}
                </motion.div>
                <motion.div
                  className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500/10 to-purple-500/10 flex items-center justify-center flex-shrink-0 group-hover:from-cyan-500/20 group-hover:to-purple-500/20 transition-colors"
                  whileHover={{ rotate: 360 }}
                  transition={{ duration: 0.5 }}
                >
                  <item.icon className="w-6 h-6 text-cyan-400" />
                </motion.div>
                <p className="text-lg font-medium text-zinc-300 group-hover:text-white transition-colors">{item.text}</p>
                <motion.div
                  className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity"
                  animate={{ x: [0, 5, 0] }}
                  transition={{ duration: 1, repeat: Infinity }}
                >
                  <ArrowRight className="w-5 h-5 text-cyan-400" />
                </motion.div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* CTA Section */}
      <section className="relative py-24 px-6">
        <motion.div
          className="max-w-4xl mx-auto text-center"
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <div className="relative p-12 rounded-3xl overflow-hidden">
            {/* Animated gradient border */}
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 rounded-3xl"
              animate={{
                backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
              }}
              transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
              style={{ backgroundSize: "200% 200%" }}
            />
            <div className="absolute inset-[2px] bg-[#030308] rounded-3xl" />
            
            <div className="relative z-10 space-y-6">
              <motion.h2
                className="text-3xl md:text-4xl font-black tracking-tight"
                animate={{ opacity: [0.8, 1, 0.8] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                Ready to Transform Your Trading?
              </motion.h2>
              <p className="text-zinc-400 max-w-md mx-auto">
                Join the future of cross-chain swaps with voice-activated AI
              </p>
              <MagneticButton
                onClick={() => router.push('/terminal')}
                className="px-10 py-4 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-xl font-bold text-lg hover:shadow-[0_0_40px_rgba(34,211,238,0.3)] transition-all duration-300"
              >
                Get Started Free
              </MagneticButton>
            </div>
          </div>
        </motion.div>
      </section>

      {/* 5. Footer */}
      <footer className="relative py-16 border-t border-white/5">
        <motion.div
          className="max-w-7xl mx-auto px-6 flex flex-col items-center gap-6"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
        >
          <motion.div
            className="flex items-center gap-2 cursor-pointer"
            whileHover={{ scale: 1.05 }}
          >
            <motion.div
              animate={{ rotate: [0, 360] }}
              transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
            >
              <Zap className="w-5 h-5 text-cyan-400" />
            </motion.div>
            <span className="text-sm font-bold tracking-widest uppercase bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
              SwapSmith Terminal
            </span>
          </motion.div>
          <div className="flex gap-6 text-xs text-zinc-600">
            {["Privacy", "Terms", "Docs"].map((item) => (
              <motion.a
                key={item}
                href="#"
                className="hover:text-cyan-400 transition-colors cursor-pointer"
                whileHover={{ y: -2 }}
              >
                {item}
              </motion.a>
            ))}
          </div>
          <p className="text-xs text-zinc-700">
            © 2026 SwapSmith. Built with AI.
          </p>
        </motion.div>
      </footer>
    </div>
  )
}