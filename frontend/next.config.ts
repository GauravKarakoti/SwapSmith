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
  turbopack: {}
};

export default nextConfig;