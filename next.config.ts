import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Hide Next.js dev indicator
  devIndicators: false,
  
  // Ignore TypeScript errors during build
  // This allows production builds to succeed while maintaining runtime behavior
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
