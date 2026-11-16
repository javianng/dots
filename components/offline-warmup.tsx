"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { OFFLINE_PAGES } from "@/lib/offline-pages";

/**
 * When dots opens online, quietly prefetches every page so the service worker
 * saves their page data (see app/sw.ts). Without it, a screen you hadn't
 * visited this session would need a full page reload to open offline.
 */
export function OfflineWarmup() {
  const router = useRouter();

  React.useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    let cancelled = false;

    const warm = () => {
      if (cancelled || !navigator.onLine) return;
      for (const href of OFFLINE_PAGES) {
        // The pieces Next uses for a normal tap…
        router.prefetch(href);
        // …and the whole page's data, which Next asks for instead when it
        // has nothing prefetched yet (e.g. a redirect right after launch).
        // `_rsc` keeps it apart from the page's precached HTML, like Next's own requests.
        void fetch(`${href}?_rsc=warmup`, { headers: { RSC: "1" } }).catch(() => {});
      }
    };

    // Wait until the service worker controls the page (so it sees the
    // requests), then until the browser is idle.
    void navigator.serviceWorker.ready.then(() => {
      const start = () => {
        if ("requestIdleCallback" in window) window.requestIdleCallback(warm, { timeout: 4000 });
        else setTimeout(warm, 1500);
      };
      if (navigator.serviceWorker.controller) start();
      else navigator.serviceWorker.addEventListener("controllerchange", start, { once: true });
    });

    return () => {
      cancelled = true;
    };
  }, [router]);

  return null;
}
