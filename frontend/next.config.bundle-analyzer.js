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
  },
  webpack: (config, { isServer }) => {
    // Optimize bundle splitting
    if (!isServer) {
      config.optimization.splitChunks = {
        ...config.optimization.splitChunks,
        cacheGroups: {
          ...config.optimization.splitChunks.cacheGroups,
          // Separate heavy libraries into their own chunks
          three: {
            name: 'three',
            test: /[\\/]node_modules[\\/](three)[\\/]/,
            chunks: 'all',
            priority: 30,
          },
          framerMotion: {
            name: 'framer-motion',
            test: /[\\/]node_modules[\\/](framer-motion)[\\/]/,
            chunks: 'all',
            priority: 30,
          },
          web3: {
            name: 'web3',
            test: /[\\/]node_modules[\\/](wagmi|viem|@wagmi|@tanstack\/react-query)[\\/]/,
            chunks: 'all',
            priority: 25,
          },
          firebase: {
            name: 'firebase',
            test: /[\\/]node_modules[\\/](firebase|firebase-admin)[\\/]/,
            chunks: 'all',
            priority: 25,
          },
          animations: {
            name: 'animations',
            test: /[\\/]node_modules[\\/](gsap|lenis|matter-js)[\\/]/,
            chunks: 'all',
            priority: 20,
          },
        },
      }
    }
    return config
  },
})