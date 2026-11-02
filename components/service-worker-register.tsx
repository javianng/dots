"use client";

import * as React from "react";

import { registerServiceWorker } from "@/lib/push";

/** Registers /sw.js once on load so push reminders can be delivered. */
export function ServiceWorkerRegister() {
  React.useEffect(() => {
    void registerServiceWorker();
  }, []);
  return null;
}
