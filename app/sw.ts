/// <reference lib="webworker" />
/*
 * dots service worker, bundled by Serwist (see app/serwist/[path]/route.ts).
 *
 * - Precaches the app's pages and static assets so dots opens with no signal.
 * - Caches pages and data requests at runtime with Serwist's Next.js defaults.
 * - Receives Web Push reminders and opens the app on tap.
 *
 * Habit data itself isn't cached here: Firestore keeps it in IndexedDB and
 * syncs offline changes on its own (lib/firebase.ts).
 */
import { defaultCache } from "@serwist/turbopack/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

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
  runtimeCaching: defaultCache,
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
