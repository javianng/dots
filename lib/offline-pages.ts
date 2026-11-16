/**
 * Every page in dots. The service worker precaches their HTML on install
 * (app/serwist/[path]/route.ts), and OfflineWarmup prefetches their page data
 * whenever the app opens online, so any screen opens offline, including by
 * tapping a link inside the app.
 */
export const OFFLINE_PAGES = [
  "/",
  "/habit",
  "/habit/edit",
  "/habits/new",
  "/settings",
  "/login",
  "/signup",
  "/privacy",
  "/terms",
  "/~offline",
] as const;
