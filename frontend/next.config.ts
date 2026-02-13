import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  // Empty turbopack config to silence the warning
  // MetaMask SDK SSR errors are expected and don't affect functionality
  turbopack: {},
};

export default nextConfig;
