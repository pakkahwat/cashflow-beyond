import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // Explicitly set root so Next.js doesn't pick up the parent repo's lockfile
    root: __dirname,
  },
};

export default nextConfig;
