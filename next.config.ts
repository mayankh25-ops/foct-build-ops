import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The e2e suite runs TWO builds side by side — a demo-mode one and a
  // live-mode one with placeholder Supabase env — so they need separate
  // output directories or each would clobber the other.
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
};

export default nextConfig;
