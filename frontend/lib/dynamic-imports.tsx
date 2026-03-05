import dynamic from 'next/dynamic'
import { useState, useEffect } from 'react'

// Framer Motion dynamic imports
export const MotionDiv = dynamic(
  () => import('framer-motion').then(mod => ({ default: mod.motion.div })),
  { ssr: false }
)

export const MotionSection = dynamic(
  () => import('framer-motion').then(mod => ({ default: mod.motion.section })),
  { ssr: false }
)

export const MotionButton = dynamic(
  () => import('framer-motion').then(mod => ({ default: mod.motion.button })),
  { ssr: false }
)

export const AnimatePresence = dynamic(
  () => import('framer-motion').then(mod => ({ default: mod.AnimatePresence })),
  { ssr: false }
)

// Web3 dynamic imports
export const WalletConnector = dynamic(
  () => import('@/components/WalletConnector'),
  { 
    ssr: false,
    loading: () => (
      <div className="animate-pulse bg-gray-700 rounded-lg h-10 w-32" />
    )
  }
)

export const SwapConfirmation = dynamic(
  () => import('@/components/SwapConfirmation'),
  { 
    ssr: false,
    loading: () => (
      <div className="animate-pulse bg-gray-800 rounded-lg p-6 space-y-4">
        <div className="h-4 bg-gray-700 rounded w-3/4"></div>
        <div className="h-4 bg-gray-700 rounded w-1/2"></div>
        <div className="h-10 bg-gray-700 rounded"></div>
      </div>
    )
  }
)

// Heavy UI components
export const StrategyMarketplace = dynamic(
  () => import('@/components/StrategyMarketplace'),
  { 
    ssr: false,
    loading: () => (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-gray-700 rounded w-1/3"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-48 bg-gray-800 rounded-lg"></div>
          ))}
        </div>
      </div>
    )
  }
)

export const PriceAlertManager = dynamic(
  () => import('@/components/PriceAlertManager'),
  { 
    ssr: false,
    loading: () => (
      <div className="animate-pulse space-y-4">
        <div className="h-6 bg-gray-700 rounded w-1/4"></div>
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-800 rounded-lg"></div>
          ))}
        </div>
      </div>
    )
  }
)

export const PortfolioRebalance = dynamic(
  () => import('@/components/PortfolioRebalance'),
  { 
    ssr: false,
    loading: () => (
      <div className="animate-pulse bg-gray-800 rounded-lg p-6">
        <div className="h-6 bg-gray-700 rounded w-1/3 mb-4"></div>
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-4 bg-gray-700 rounded"></div>
          ))}
        </div>
      </div>
    )
  }
)

// Chart components
export const CryptoChart = dynamic(
  () => import('@/components/CryptoChart'),
  { 
    ssr: false,
    loading: () => (
      <div className="animate-pulse bg-gray-800 rounded-lg h-64 flex items-center justify-center">
        <div className="text-gray-400">Loading chart...</div>
      </div>
    )
  }
)

// Animation utilities
export const useFramerMotion = () => {
  const [motion, setMotion] = useState<any>(null)
  
  useEffect(() => {
    import('framer-motion').then(mod => {
      setMotion({
        motion: mod.motion,
        AnimatePresence: mod.AnimatePresence,
        useMotionValue: mod.useMotionValue,
        useSpring: mod.useSpring,
        useTransform: mod.useTransform,
        useScroll: mod.useScroll
      })
    })
  }, [])
  
  return motion
}

// Smooth scrolling
export const ReactLenis = dynamic(
  () => import('lenis/react').then(mod => ({ default: mod.ReactLenis })),
  { ssr: false }
)

// Three.js components
export const AuroraBackground = dynamic(
  () => import('@/components/AuroraBackground'),
  { 
    ssr: false,
    loading: () => (
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-br from-purple-900/20 via-blue-900/20 to-teal-900/20" />
    )
  }
)