import { withSerwist } from "@serwist/turbopack";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // React <ViewTransition> integration for iOS-style page transitions.
    viewTransition: true,
  },
  async redirects() {
    // Habit screens moved from /habits/:id to /habit?id= so they cache offline.
    // Keep old links (bookmarks, history) working.
    return [
      // Life in Weeks is now a tab on the home screen.
      { source: "/life", destination: "/", permanent: false },
      { source: "/habits/:id/edit", destination: "/habit/edit?id=:id", permanent: true },
      { source: "/habits/:id((?!new$)[^/]+)", destination: "/habit?id=:id", permanent: true },
    ];
  },
};

// Serwist bundles app/sw.ts with esbuild at runtime, so keep esbuild out of
// the server bundle.
export default withSerwist(nextConfig);
