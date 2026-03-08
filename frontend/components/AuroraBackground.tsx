'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'

// Dynamically import Three.js only when needed
const ThreeAuroraBackground = dynamic(
  () => import('./ThreeAuroraBackground'),
  { 
    ssr: false,
    loading: () => (
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-br from-purple-900/20 via-blue-900/20 to-teal-900/20" />
    )
  }
)

export default function AuroraBackground() {
  const [shouldLoad, setShouldLoad] = useState(false)

  useEffect(() => {
    // Only load Three.js after initial render and when component is visible
    const timer = setTimeout(() => {
      setShouldLoad(true)
    }, 100)

    return () => clearTimeout(timer)
  }, [])

  if (!shouldLoad) {
    return (
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-br from-purple-900/20 via-blue-900/20 to-teal-900/20" />
    )
  }

  return <ThreeAuroraBackground />
}
