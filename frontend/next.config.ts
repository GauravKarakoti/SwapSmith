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

  // Leave empty to use defaults, or configure if needed
  turbopack: {}
};

export default nextConfig;