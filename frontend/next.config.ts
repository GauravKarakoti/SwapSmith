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

  // Security headers for production
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },

  turbopack: {}
};

export default nextConfig;