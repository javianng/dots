import { createSerwistRoute } from "@serwist/turbopack";
import { spawnSync } from "node:child_process";

import { OFFLINE_PAGES } from "@/lib/offline-pages";

// Bumps the precached pages on every deploy. Vercel exposes the commit; local
// builds fall back to git, then to a timestamp.
const revision =
  process.env.VERCEL_GIT_COMMIT_SHA ??
  (spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf-8" }).stdout?.trim() ||
    String(Date.now()));

export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } =
  createSerwistRoute({
    swSrc: "app/sw.ts",
    useNativeEsbuild: true,
    additionalPrecacheEntries: OFFLINE_PAGES.map((url) => ({ url, revision })),
  });
