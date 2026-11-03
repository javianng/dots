"use client";

import * as React from "react";

import { registerServiceWorker } from "@/lib/push";

/** Registers the service worker once on load: offline caching and push reminders. */
export function ServiceWorkerRegister() {
  React.useEffect(() => {
    void registerServiceWorker();
  }, []);
  return null;
}
