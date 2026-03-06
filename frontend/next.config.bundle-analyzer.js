// eslint-disable-next-line @typescript-eslint/no-require-imports
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
})

module.exports = withBundleAnalyzer({
  // Your existing Next.js config
  experimental: {
    optimizePackageImports: [
      'framer-motion',
      'three',
      'matter-js',
      'gsap',
      'lenis',
      '@tanstack/react-query',
      'wagmi',
      'viem',
      'firebase',
      'lucide-react'
    ]
  }
})