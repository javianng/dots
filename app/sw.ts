/// <reference lib="webworker" />
/*
 * dots service worker, bundled by Serwist (see app/serwist/[path]/route.ts).
 *
 * - Precaches the app's pages and static assets so dots opens with no signal.
 * - Caches Next's page data (RSC) under a stable key so in-app navigation
 *   works offline instead of falling back to a full page reload.
 * - Stops Firebase's sign-in check from holding up launch on a weak signal.
 * - Caches other requests at runtime with Serwist's Next.js defaults.
 * - Receives Web Push reminders and opens the app on tap.
 *
 * Habit data itself isn't cached here: Firestore keeps it in IndexedDB and
 * syncs offline changes on its own (lib/firebase.ts).
 */
import { defaultCache } from "@serwist/turbopack/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { ExpirationPlugin, NetworkFirst, NetworkOnly, Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

// --- Page data (RSC) --------------------------------------------------------
//
// Moving between screens, Next fetches each page's data as RSC requests
// (`/settings?_rsc=…` with an `RSC: 1` header), split into segments named by
// the `Next-Router-Segment-Prefetch` header. The `_rsc` value is a hash that
// changes with the page you navigate *from*, so cached responses never match
// again and, offline, every tap fell back to a full page reload. Every page in
// dots is static, so a response depends only on the path and the segment:
// cache it under that key instead. A fresh cache per deploy keeps data from
// an older build away from the new one.

const BUILD =
  self.__SW_MANIFEST?.find((e): e is PrecacheEntry => typeof e !== "string" && e.url === "/")
    ?.revision ?? "dev";
const RSC_CACHE = `dots-rsc-${BUILD}`;

function rscCacheKey(request: Request): string {
  const url = new URL(request.url);
  // Strip search params a segment name may carry (e.g. `/habit/__PAGE__?…`):
  // habit screens read `?id=` on the client, so their data is the same.
  const segment = (request.headers.get("Next-Router-Segment-Prefetch") ?? "").split("?")[0];
  // `_tree` and `_head` describe the page being opened. Every other segment
  // (a layout or page, e.g. `/_index`, `/settings/__PAGE__`) is named after
  // itself and shared by every page that uses it, so it's saved once for all.
  if (segment && segment !== "/_tree" && segment !== "/_head") {
    return `${url.origin}/__rsc?segment=${encodeURIComponent(segment)}`;
  }
  const kind = segment || (request.headers.get("Next-Router-Prefetch") === "1" ? "prefetch" : "page");
  return `${url.origin}${url.pathname}?__rsc=${encodeURIComponent(kind)}`;
}

const pageData = {
  matcher: ({ request, url, sameOrigin }: { request: Request; url: URL; sameOrigin: boolean }) =>
    sameOrigin && request.headers.get("RSC") === "1" && !url.pathname.startsWith("/api/"),
  handler: new NetworkFirst({
    cacheName: RSC_CACHE,
    // On a weak signal, don't hang: use the saved copy after 3 seconds.
    networkTimeoutSeconds: 3,
    matchOptions: { ignoreVary: true },
    plugins: [
      { cacheKeyWillBeUsed: async ({ request }) => rscCacheKey(request) },
      new ExpirationPlugin({ maxEntries: 200 }),
    ],
  }),
};

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => name.startsWith("dots-rsc-") && name !== RSC_CACHE)
            .map((name) => caches.delete(name))
        )
      )
  );
});

// --- Sign-in check on launch ---------------------------------------------
//
// On every launch Firebase Auth checks the saved user with Google
// (accounts:lookup, plus a token refresh if it's over an hour old) before it
// reports who's signed in, and Firestore waits for that before reading even
// its local cache. On a weak signal the check can hang for 30s+, leaving dots
// on skeletons. A network failure keeps the user signed in, so give up after
// 5 seconds and let dots open from its saved data; Firebase checks again later.

const authCheck = {
  matcher: ({ url }: { url: URL }) =>
    (url.hostname === "identitytoolkit.googleapis.com" && url.pathname === "/v1/accounts:lookup") ||
    (url.hostname === "securetoken.googleapis.com" && url.pathname === "/v1/token"),
  method: "POST" as const,
  handler: new NetworkOnly({ networkTimeoutSeconds: 5 }),
};

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  precacheOptions: {
    // Habit screens are one page each (`/habit?id=…`), so any id is served by
    // the precached page while offline.
    ignoreURLParametersMatching: [/^utm_/, /^fbclid$/, /^id$/],
  },
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [authCheck, pageData, ...defaultCache],
  fallbacks: {
    entries: [
      {
        url: "/~offline",
        matcher: ({ request }) => request.destination === "document",
      },
    ],
  },
});

serwist.addEventListeners();

// --- Web Push reminders ---------------------------------------------------

self.addEventListener("push", (event) => {
  let data: { title?: string; body?: string; tag?: string; url?: string } = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }

  // iOS revokes push permission if a push arrives without a visible
  // notification, so always show one.
  event.waitUntil(
    self.registration.showNotification(data.title || "dots", {
      body: data.body || "Time to fill in today's dots.",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: data.tag || "dots-reminder",
      data: { url: data.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/", self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.startsWith(self.location.origin) && "focus" in client) {
          void (client as WindowClient).navigate?.(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
