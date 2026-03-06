import type { NextConfig } from "next";
import path from "path";

// Check if we are building on Vercel
const isVercel = process.env.VERCEL === "1";

const nextConfig: NextConfig = {
  // Only use standalone mode when NOT on Vercel
  output: isVercel ? undefined : "standalone",
  
  // Enable compilation for the shared folder
  transpilePackages: ['@swapsmith/shared'],
  
  // Only set custom tracing root when NOT on Vercel
  ...(isVercel ? {} : { outputFileTracingRoot: path.join(process.cwd(), '../') }),

  // Bundle optimization with webpack
  webpack: (config, { dev, isServer }) => {
    // Optimize bundle splitting for heavy libraries
    if (!dev && !isServer) {
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          ...config.optimization.splitChunks,
          cacheGroups: {
            ...config.optimization.splitChunks?.cacheGroups,
            // Three.js bundle
            three: {
              test: /[\\/]node_modules[\\/](three|@react-three)[\\/]/,
              name: 'three',
              chunks: 'all',
              priority: 30,
            },
            // Framer Motion bundle
            framerMotion: {
              test: /[\\/]node_modules[\\/]framer-motion[\\/]/,
              name: 'framer-motion',
              chunks: 'all',
              priority: 25,
            },
            // Web3 libraries bundle
            web3: {
              test: /[\\/]node_modules[\\/](wagmi|viem|@wagmi|@rainbow-me|ethers|web3)[\\/]/,
              name: 'web3',
              chunks: 'all',
              priority: 20,
            },
            // Animation libraries bundle
            animations: {
              test: /[\\/]node_modules[\\/](lenis|gsap|matter-js)[\\/]/,
              name: 'animations',
              chunks: 'all',
              priority: 15,
            },
            // Firebase bundle
            firebase: {
              test: /[\\/]node_modules[\\/]firebase[\\/]/,
              name: 'firebase',
              chunks: 'all',
              priority: 10,
            },
          },
        },
      };
    }

    return config;
  },

  // Security headers for production
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ];
  },

  // Leave empty to use defaults, or configure if needed
  turbopack: {}
};

export default nextConfig;