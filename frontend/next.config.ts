import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: "standalone",
  
  // Enable compilation for the shared folder
  transpilePackages: ['@swapsmith/shared'],
  
  // Correctly trace files from the monorepo root (one level up)
  // This works dynamically for both Local (Windows/Mac) and Docker
  outputFileTracingRoot: path.join(process.cwd(), '../'),

  // Leave empty to use defaults, or configure if needed
  turbopack: {},

  // Environment variables that should be available at build time
  // Use a dummy value for build if DATABASE_URL is not set
  env: {
    DATABASE_URL: process.env.DATABASE_URL || 'postgresql://dummy:dummy@localhost:5432/dummy',
  },
};

export default nextConfig;
