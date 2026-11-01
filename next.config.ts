import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // React <ViewTransition> integration for iOS-style page transitions.
    viewTransition: true,
  },
};

export default nextConfig;
