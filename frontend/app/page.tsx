'use client'

import { useRouter } from 'next/navigation'
import { motion, useMotionValue, useSpring } from 'framer-motion'
import { Zap, Mic, Shield, ArrowRight, Wallet, MessageSquare, CheckCircle, ListChecks, BarChart3, Sparkles, TrendingUp } from 'lucide-react'
import { useEffect, useState, useRef } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { ReactLenis } from 'lenis/react'
import { animate, scroll } from 'motion' 
import Footer from '@/components/Footer'
import Navbar from '@/components/Navbar'
import { RandomizedTextEffect } from '@/components/RandomizedTextEffect'
import FAQSection from '@/components/FAQSection'

// Dashboard Preview Component - Customized for SwapSmith (Crypto Theme)
const DashboardPreview = () => (
  <div className="absolute inset-0 pointer-events-none z-0">
    {/* Left Card - Portfolio Analytics */}
    <motion.div 
      initial={{ opacity: 0, x: -100, rotate: -12 }}
      animate={{ 
        opacity: 1, 
        x: 0, 
        rotate: -6,
        y: [-10, 10, -10]
      }}
      transition={{ 
        opacity: { duration: 1, delay: 0.5 },
        x: { duration: 1, delay: 0.5 },
        rotate: { duration: 1, delay: 0.5 },
        y: { duration: 6, repeat: Infinity, ease: "easeInOut" }
      }}
      style={{ left: '5%', top: '20%' }}
      className="absolute hidden xl:block p-6 bg-[#0a0a12]/90 backdrop-blur-md rounded-3xl shadow-2xl w-[320px] text-white border border-white/10"
    >
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-cyan-900/30 flex items-center justify-center border border-cyan-500/30">
            <BarChart3 className="w-5 h-5 text-cyan-400" />
          </div>
          <span className="font-bold text-sm text-zinc-200">Portfolio Value</span>
        </div>
        <span className="text-xs font-semibold text-emerald-400 bg-emerald-900/20 px-2 py-1 rounded-full border border-emerald-500/20 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> Live
        </span>
      </div>
      
      <div className="mb-6">
        <div className="text-4xl font-black mb-1 text-white tracking-tight">$42,853.21</div>
        <div className="flex items-center gap-2 text-sm text-zinc-400">
          <span>Net Worth</span>
          <span className="text-emerald-400 font-bold bg-emerald-900/20 px-1.5 rounded text-xs">+5.24%</span>
        </div>
      </div>
      
      <div className="h-24 w-full bg-black/20 rounded-xl mb-6 relative overflow-hidden border border-white/5">
        {/* Crypto Line Chart */}
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 40" preserveAspectRatio="none">
          <defs>
            <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d="M0 40 L0 30 Q 10 25 20 28 T 40 20 T 60 15 T 80 22 T 100 10 L 100 40 Z" fill="url(#chartGradient)" />
          <path d="M0 30 Q 10 25 20 28 T 40 20 T 60 15 T 80 22 T 100 10" fill="none" stroke="#22d3ee" strokeWidth="2" strokeLinecap="round" />
        </svg>
        {/* Interactive Point */}
        <div className="absolute top-[25%] right-[20%] w-3 h-3 bg-cyan-400 rounded-full border-2 border-[#0a0a12] shadow-[0_0_10px_rgba(34,211,238,0.5)]"></div>
        
        <div className="absolute bottom-2 left-3 text-[10px] text-zinc-500 font-mono tracking-wider">BTC / USDT PRICE ACTION</div>
      </div>
      
      <div className="space-y-3">
        <div className="flex justify-between text-sm">
          <span className="font-medium text-zinc-400">Gas Tracker</span>
          <span className="font-bold text-purple-400 flex items-center gap-1">
            <Zap className="w-3 h-3" /> 12 Gwei
          </span>
        </div>
        <div className="w-full bg-zinc-800 rounded-full h-1.5">
          <div className="bg-gradient-to-r from-cyan-400 to-purple-500 h-1.5 rounded-full w-[35%]"></div>
        </div>
        <div className="flex justify-between text-xs text-zinc-500 pt-1 font-medium font-mono">
          <span>Slippage: &lt;0.5%</span>
          <span>Route: Best</span>
        </div>
      </div>
    </motion.div>

    {/* Right Card - Active Swaps / Operations */}
    <motion.div 
      initial={{ opacity: 0, x: 100, rotate: 12 }}
      animate={{ 
        opacity: 1, 
        x: 0, 
        rotate: 6,
        y: [10, -10, 10]
      }}
      transition={{ 
        opacity: { duration: 1, delay: 0.7 },
        x: { duration: 1, delay: 0.7 },
        rotate: { duration: 1, delay: 0.7 },
        y: { duration: 7, repeat: Infinity, ease: "easeInOut", delay: 1 }
      }}
      style={{ right: '5%', top: '25%' }}
      className="absolute hidden xl:block p-6 bg-[#0a0a12]/90 backdrop-blur-md rounded-3xl shadow-2xl w-[300px] text-white border border-white/10"
    >
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-pink-900/30 flex items-center justify-center border border-pink-500/30">
            <ListChecks className="w-5 h-5 text-pink-400" />
          </div>
          <span className="font-bold text-sm text-zinc-200">Active Swaps</span>
        </div>
        <span className="text-xs font-bold border border-cyan-500/30 px-2 py-1 rounded-md text-cyan-400 bg-cyan-900/20 shadow-[0_0_10px_rgba(34,211,238,0.1)]">SYNC</span>
      </div>
      
      <div className="mb-6">
        <div className="text-4xl font-black mb-1 text-white tracking-tight">1,204</div>
        <div className="text-sm text-zinc-400">Transactions Today</div>
      </div>
      
      <div className="flex gap-3 mb-6">
        <div className="flex-1 bg-white/5 p-3 rounded-xl border border-white/5 text-center transition-colors hover:bg-white/10">
          <div className="text-lg font-bold text-white">2.4s</div>
          <div className="text-[10px] text-zinc-500 uppercase font-bold tracking-wide">Avg Time</div>
        </div>
        <div className="flex-1 bg-white/5 p-3 rounded-xl border border-white/5 text-center transition-colors hover:bg-white/10">
          <div className="text-lg font-bold text-white">$4.2M</div>
          <div className="text-[10px] text-zinc-500 uppercase font-bold tracking-wide">Volume</div>
        </div>
      </div>
      
      <div className="space-y-3">
        {[
            { name: "Ethereum", label: "Bridge Active", status: "STABLE", color: "text-blue-400 bg-blue-900/30 border-blue-500/30", icon: "💎" },
            { name: "Arbitrum", label: "Low Fees", status: "FAST", color: "text-cyan-400 bg-cyan-900/30 border-cyan-500/30", icon: "⚡" },
            { name: "Solana", label: "High Speed", status: "TURBO", color: "text-purple-400 bg-purple-900/30 border-purple-500/30", icon: "🚀" }
        ].map((item, i) => (
            <div key={i} className={`flex items-center p-3 rounded-xl border transition-all hover:translate-x-1 ${
                i === 0 ? 'bg-gradient-to-r from-blue-900/20 to-transparent border-blue-500/20 ring-1 ring-blue-400/10' 
                : 'bg-white/5 border-white/5 hover:border-white/10'
            }`}>
                <div className="w-8 h-8 flex items-center justify-center text-lg">{item.icon}</div>
                <div className="flex-1 ml-2">
                    <div className="text-xs font-bold text-white group-hover:text-cyan-400 transition-colors">{item.name}</div>
                    <div className="text-[10px] text-zinc-500 font-medium">{item.label}</div>
                </div>
                <span className={`text-[10px] font-bold px-2 py-1 rounded-md border ${item.color}`}>{item.status}</span>
            </div>
        ))}
      </div>
    </motion.div>

    {/* Bottom Left Card - 'Expert Level' / AI Status */}
    <motion.div
        initial={{ opacity: 0, scale: 0.8, rotate: -5 }}
        animate={{ 
            opacity: 1, 
            scale: 1, 
            rotate: 0,
            y: [-5, 5, -5] 
        }}
        transition={{ 
            opacity: { duration: 0.8, delay: 1.2 },
            scale: { duration: 0.8, delay: 1.2 },
            rotate: { duration: 0.8, delay: 1.2 },
            y: { duration: 5, repeat: Infinity, ease: "easeInOut", delay: 0 }
        }}
        style={{ left: '15%', bottom: '15%' }}
        className="absolute hidden xl:block p-4 bg-[#0a0a12]/90 backdrop-blur-md rounded-2xl shadow-xl w-[220px] text-white border border-white/10 z-10"
    >
        <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-full bg-gradient-to-r from-pink-500 to-rose-500 flex items-center justify-center">
                <Sparkles className="w-3 h-3 text-white" />
            </div>
            <span className="text-xs font-bold text-transparent bg-gradient-to-r from-pink-400 to-rose-400 bg-clip-text">AI Agent Active</span>
        </div>
        <h4 className="font-black text-lg text-white mb-1">SwapSmith Pro</h4>
        <p className="text-[10px] text-zinc-400 mb-3">Auto-routing optimization enabled</p>
        <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
            <motion.div 
                className="h-full bg-gradient-to-r from-pink-500 to-rose-500"
                animate={{ width: ["0%", "100%"] }}
                transition={{ duration: 2, repeat: Infinity }}
            />
        </div>
    </motion.div>
    
    {/* Floating Background Words - Crypto Themed */}
     <motion.div animate={{ rotate: 360 }} transition={{ duration: 150, repeat: Infinity, ease: 'linear' }} className="absolute left-[10%] top-[15%] text-white/[0.03] font-black text-7xl select-none -z-10 blur-[2px] pointer-events-none tracking-tighter">
        LIQUIDITY
     </motion.div>
     <motion.div animate={{ rotate: -360 }} transition={{ duration: 180, repeat: Infinity, ease: 'linear' }} className="absolute right-[8%] bottom-[25%] text-white/[0.03] font-black text-7xl select-none -z-10 blur-[2px] pointer-events-none tracking-tighter">
        PROTOCOL
     </motion.div>
     <motion.div animate={{ y: [-20, 20, -20] }} transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }} className="absolute left-[20%] bottom-[30%] text-cyan-500/5 font-black text-5xl select-none -z-10 transform -rotate-12 pointer-events-none">
        GAS
     </motion.div>
  </div>
)

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
  const ulRef = useRef<HTMLUListElement>(null)
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

  useEffect(() => {
    // Add a delay to ensure DOM is fully ready
    const timer = setTimeout(() => {
      const items = document.querySelectorAll('.horizontal-scroll-item')
      const section = document.querySelector('.horizontal-section')

      if (ulRef.current && items.length > 0 && section) {
        // Animate the horizontal scroll
        const controls = animate(
          ulRef.current,
          {
            transform: ['translateX(0vw)', `translateX(-${(items.length - 1) * 100}vw)`],
          },
          { duration: 1 }
        )
        
        scroll(controls, { 
          target: section,
          offset: ['start start', 'end end']
        })
      }
    }, 100)

    return () => clearTimeout(timer)
  }, [])

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
    <ReactLenis root>
      {/* Main Landing Page Content */}
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
      <Navbar />

      {/* 2. Hero Section */}
      <section className="relative pt-40 pb-24 px-6 overflow-hidden">
        <DashboardPreview />
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
                &ldquo;Swap half of my MATIC on Polygon for 50 USDC on Arbitrum.&rdquo;
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

      {/* Mobile Mockup Section (AutoML Style) */}
      <section className="relative py-32 px-6 overflow-hidden max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left Side - Text Content */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="space-y-8 relative z-10"
          >
            <h2 className="text-5xl md:text-6xl font-black tracking-tighter leading-tight">
              Accelerate trading <br />
              innovation with <br />
              <span className="bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">automated AI</span> <br />
              strategies and build <br />
              <span className="text-zinc-500">wealth that lasts.</span>
            </h2>
            
            <p className="text-xl text-zinc-400 max-w-lg leading-relaxed">
              The all-in-one SwapSmith platform to automate trading workflows, from intent recognition to execution. Empower your portfolio to grow, diversify, and outperform the market—no complex coding required.
            </p>

            {/* Feature Card */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-colors cursor-default">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <h4 className="font-bold text-lg mb-2">How does AI-Powered Trading boost profitability?</h4>
                  <p className="text-zinc-400 text-sm leading-relaxed">
                    Our platform automates market analysis, route optimization, gas estimation, and slippage protection. Instantly execute best-price swaps across 40+ chains with a single voice command—freeing you to focus on strategy.
                  </p>
                </div>
                <button className="w-8 h-8 rounded-full border border-white/20 flex items-center justify-center hover:bg-white/10 flex-shrink-0">
                   <div className="w-2 h-2 rounded-full bg-cyan-400" />
                </button>
              </div>
            </div>
          </motion.div>

          {/* Right Side - Phone Mockup */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
            className="relative"
          >
            {/* Background decorative circles */}
            <motion.div 
               animate={{ y: [-20, 20, -20] }} 
               transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
               className="absolute -top-10 -left-10 w-24 h-24 rounded-full border border-white/10 z-0 bg-transparent" 
            />
            <motion.div 
               animate={{ scale: [1, 1.2, 1] }} 
               transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
               className="absolute top-1/2 -right-12 w-16 h-16 rounded-full border border-cyan-500/20 z-0 bg-cyan-500/5 backdrop-blur-sm" 
            />
             <motion.div 
               animate={{ y: [20, -20, 20] }} 
               transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
               className="absolute -bottom-8 left-1/4 w-20 h-20 rounded-full border border-purple-500/20 z-0 bg-purple-500/5" 
            />

            {/* Phone Frame */}
            <div className="relative z-10 w-[360px] h-[720px] bg-[#0f0f16] rounded-[3rem] border-8 border-[#1a1a24] shadow-2xl mx-auto overflow-hidden">
               {/* Phone Notch/Status Bar */}
               <div className="h-8 w-full flex justify-between items-center px-6 pt-3 pb-1">
                 <span className="text-[10px] font-medium text-white">10:24</span>
                 <div className="w-16 h-4 bg-black/50 rounded-full" />
                 <div className="w-4 h-2.5 border border-white/30 rounded-[2px]" />
               </div>

               {/* App Content */}
               <div className="p-6 h-full font-sans">
                  {/* Header */}
                  <div className="flex items-center gap-3 mb-8">
                     <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-600 to-blue-700 flex items-center justify-center shadow-lg shadow-cyan-900/20">
                        <Zap className="w-6 h-6 text-white" fill="currentColor" />
                     </div>
                     <div>
                        <h3 className="font-bold text-lg leading-tight">SwapSmith App</h3>
                        <p className="text-xs text-zinc-500">Portfolio: Main Wallet</p>
                     </div>
                  </div>

                  {/* Main Card */}
                  <div className="border border-white/10 rounded-3xl p-6 bg-white/5 backdrop-blur-sm mb-6 relative overflow-hidden">
                     <div className="flex justify-between items-start mb-6">
                        <div>
                           <div className="text-xs text-zinc-400 font-medium mb-1">Total Balance</div>
                           <div className="text-3xl font-black tracking-tight flex items-start gap-1">
                              $12,450
                              <span className="text-xs font-bold text-emerald-400 mt-2">+12%</span>
                           </div>
                        </div>
                        <div className="bg-emerald-500/10 p-2 rounded-full">
                           <TrendingUp className="w-4 h-4 text-emerald-400" />
                        </div>
                     </div>
                     
                     <div className="space-y-2">
                        <div className="text-xs text-zinc-500">Asset Allocation</div>
                        <div className="w-full h-2 bg-black/40 rounded-full flex overflow-hidden">
                           <div className="w-[45%] bg-cyan-500 h-full" />
                           <div className="w-[30%] bg-purple-500 h-full" />
                           <div className="w-[25%] bg-pink-500 h-full" />
                        </div>
                        <div className="flex justify-between text-[10px] text-zinc-400 pt-1">
                           <span>ETH 45%</span>
                           <span>SOL 30%</span>
                           <span>USDC 25%</span>
                        </div>
                     </div>
                  </div>

                  {/* Secondary Cards (List) */}
                  <div className="space-y-4">
                     {/* Card 1 */}
                     <div className="bg-[#181820] rounded-2xl p-4 flex items-center gap-4 border border-white/5 shadow-lg">
                        <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                           <span className="text-lg">💎</span>
                        </div>
                        <div className="flex-1">
                           <div className="text-sm font-bold text-white">Ethereum</div>
                           <div className="text-[10px] text-zinc-500">Bridge Active • 2 min ago</div>
                        </div>
                        <div className="w-4 h-4 rounded-full bg-green-500/20 flex items-center justify-center">
                           <CheckCircle className="w-3 h-3 text-green-500" />
                        </div>
                     </div>

                     {/* Card 2 */}
                     <div className="bg-gradient-to-r from-cyan-900/40 to-blue-900/40 rounded-2xl p-4 flex items-center gap-4 border border-cyan-500/30">
                        <div className="w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center border border-cyan-500/20 animate-pulse">
                           <Zap className="w-5 h-5 text-cyan-400" />
                        </div>
                        <div className="flex-1">
                           <div className="text-sm font-bold text-white">Swap Executing</div>
                           <div className="text-[10px] text-cyan-300">Finding best route...</div>
                        </div>
                        <div className="text-xs font-mono text-cyan-400">65%</div>
                     </div>

                     {/* Card 3 */}
                     <div className="bg-[#181820] rounded-2xl p-4 flex items-center gap-4 border border-white/5 shadow-lg opacity-60">
                         <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
                           <span className="text-lg">🟣</span>
                        </div>
                        <div className="flex-1">
                           <div className="text-sm font-bold text-white">Polygon</div>
                           <div className="text-[10px] text-zinc-500">Queued • Starts in 5s</div>
                        </div>
                        <div className="w-4 h-4 rounded-full border border-white/20" />
                     </div>
                  </div>
               </div>
            </div>
            
            {/* Background Glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[600px] bg-cyan-500/20 blur-[100px] pointer-events-none -z-10" />
          </motion.div>
        </div>
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

      {/* Scroll Animation Section - After Footer */}
      <article>
        <section className='text-white h-screen w-full bg-[#030712] grid place-content-center sticky top-0'>
          <div className='absolute bottom-0 left-0 right-0 top-0 bg-[linear-gradient(to_right,#4f4f4f2e_1px,transparent_1px),linear-gradient(to_bottom,#4f4f4f2e_1px,transparent_1px)] bg-[size:54px_54px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]'></div>

          <div className='relative z-10 max-w-4xl mx-auto px-8'>
            <h1 className='2xl:text-7xl text-6xl font-semibold text-center tracking-tight leading-[120%] mb-6'>
              Ready to Transform <br /> Your Trading? Scroll Please
            </h1>
            <p className='text-xl text-gray-400 text-center mt-4'>
              Experience the future of cross-chain swaps with AI-powered voice commands
            </p>
          </div>
        </section>

        <section className='bg-[#0B1120] text-white grid place-content-center h-screen sticky top-0 rounded-tr-2xl rounded-tl-2xl overflow-hidden'>
          <div className='absolute bottom-0 left-0 right-0 top-0 bg-[linear-gradient(to_right,#4f4f4f2e_1px,transparent_1px),linear-gradient(to_bottom,#4f4f4f2e_1px,transparent_1px)] bg-[size:54px_54px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]'></div>
          <div className='relative z-10 max-w-5xl mx-auto px-8'>
            <h1 className='2xl:text-7xl text-4xl font-semibold text-center tracking-tight leading-[120%] mb-6'>
              Voice-Activated Cross-Chain Swaps, <br /> Built with AI & Open Source 💼
            </h1>
            <div className='grid grid-cols-3 gap-6 mt-12'>
              <div className='bg-white/10 p-6 rounded-xl backdrop-blur-sm border border-white/10'>
                <h3 className='text-2xl font-bold mb-2'>200+</h3>
                <p className='text-gray-300'>Supported Assets</p>
              </div>
              <div className='bg-white/10 p-6 rounded-xl backdrop-blur-sm border border-white/10'>
                <h3 className='text-2xl font-bold mb-2'>40+</h3>
                <p className='text-gray-300'>Blockchain Networks</p>
              </div>
              <div className='bg-white/10 p-6 rounded-xl backdrop-blur-sm border border-white/10'>
                <h3 className='text-2xl font-bold mb-2'>0%</h3>
                <p className='text-gray-300'>Platform Fees</p>
              </div>
            </div>
          </div>
        </section>

        <section className='text-white h-screen w-full bg-[#130E18] grid place-content-center sticky top-0'>
          <div className='absolute bottom-0 left-0 right-0 top-0 bg-[linear-gradient(to_right,#4f4f4f2e_1px,transparent_1px),linear-gradient(to_bottom,#4f4f4f2e_1px,transparent_1px)] bg-[size:54px_54px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]'></div>
          <div className='relative z-10 max-w-4xl mx-auto px-8'>
            <h1 className='2xl:text-7xl text-5xl font-semibold text-center tracking-tight leading-[120%] mb-6'>
              Thanks for Scrolling!
              <br /> Keep Going for More 
            </h1>
            <div className='flex justify-center gap-8 mt-12'>
              <div className='text-center'>
                <div className='text-cyan-400 text-4xl mb-2'>⚡</div>
                <p className='text-gray-400'>Lightning Fast</p>
              </div>
              <div className='text-center'>
                <div className='text-purple-400 text-4xl mb-2'>🔒</div>
                <p className='text-gray-400'>Secure & Safe</p>
              </div>
              <div className='text-center'>
                <div className='text-pink-400 text-4xl mb-2'>🎯</div>
                <p className='text-gray-400'>Easy to Use</p>
              </div>
            </div>
          </div>
        </section>
      </article>

      {/* Horizontal Scroll Animation Section */}
      <article>
        <header className='text-white relative w-full bg-slate-950 grid place-content-center h-[80vh]'>
          <div className='absolute bottom-0 left-0 right-0 top-0 bg-[linear-gradient(to_right,#4f4f4f2e_1px,transparent_1px),linear-gradient(to_bottom,#4f4f4f2e_1px,transparent_1px)] bg-[size:14px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]'></div>

          <h1 className='text-6xl font-bold text-center tracking-tight relative z-10'>
            I Know You Love to Scroll <br />
            So Keep Scrolling →
          </h1>
        </header>
        <section className='horizontal-section h-[500vh] relative'>
          <ul ref={ulRef} className='flex sticky top-0 h-screen overflow-hidden' style={{ width: '500vw' }}>
            <li className='horizontal-scroll-item h-screen w-screen flex-shrink-0 bg-slate-950 flex flex-col justify-center items-center px-12 border-r border-white/5'>
              <h2 className='text-[20vw] font-bold text-cyan-500 select-none mb-8'>
                TRADE
              </h2>
              <p className='text-3xl text-zinc-400 max-w-3xl text-center font-medium'>
                Execute complex cross-chain swaps with simple voice commands. Trade 200+ assets across 40+ networks.
              </p>
            </li>
            <li className='horizontal-scroll-item h-screen w-screen flex-shrink-0 bg-[#0f0a1e] flex flex-col justify-center items-center px-12 border-r border-white/5'>
              <h2 className='text-[20vw] font-bold text-purple-500 select-none mb-8'>
                SWAP
              </h2>
              <p className='text-3xl text-zinc-400 max-w-3xl text-center font-medium'>
                Seamless asset exchanges powered by SideShift.ai. Get real-time quotes and best rates instantly.
              </p>
            </li>
            <li className='horizontal-scroll-item h-screen w-screen flex-shrink-0 bg-[#1a0b14] flex flex-col justify-center items-center px-12 border-r border-white/5'>
              <h2 className='text-[20vw] font-bold text-pink-500 select-none mb-8'>
                EARN
              </h2>
              <p className='text-3xl text-zinc-400 max-w-3xl text-center font-medium'>
                Discover yield opportunities across DeFi protocols. Maximize your crypto earnings effortlessly.
              </p>
            </li>
            <li className='horizontal-scroll-item h-screen w-screen flex-shrink-0 bg-[#051a12] flex flex-col justify-center items-center px-12 border-r border-white/5'>
              <h2 className='text-[20vw] font-bold text-emerald-500 select-none mb-8'>
                GROW
              </h2>
              <p className='text-3xl text-zinc-400 max-w-3xl text-center font-medium'>
                Build your portfolio with AI-assisted trading strategies. Make informed decisions with confidence.
              </p>
            </li>
            <li className='horizontal-scroll-item h-screen w-screen flex-shrink-0 bg-[#1a0f05] flex flex-col justify-center items-center px-12'>
              <h2 className='text-[20vw] font-bold text-orange-500 select-none mb-8'>
                WIN
              </h2>
              <p className='text-3xl text-zinc-400 max-w-3xl text-center font-medium'>
                Join thousands of traders using SwapSmith. Experience the future of decentralized trading today.
              </p>
            </li>
          </ul>
        </section>
        {/* FAQ Section */}
        <FAQSection />

        <footer className='relative font-medium text-white grid place-content-center h-[80vh] overflow-hidden'>
          {/* Background Image with Blur */}
          <div 
            className="absolute inset-0 bg-[url('/image.png')] bg-cover bg-center"
            style={{ filter: 'blur(8px)' }}
          />
          {/* Dark Overlay for better text readability */}
          <div className="absolute inset-0 bg-black/20" />
          
          <div className='relative z-10 text-center space-y-4'>
            <div className='text-3xl md:text-4xl font-bold mb-8'>
              <RandomizedTextEffect text="Ready to Start Your Journey?" />
            </div>
            <button
              onClick={handleAccess}
              className='px-8 py-4 bg-white text-purple-600 rounded-full font-bold text-lg hover:scale-105 transition-transform shadow-lg'
            >
              Launch SwapSmith Now
            </button>
          </div>
        </footer>
        <Footer/>
      </article>
    </ReactLenis>
  )
}