"use client";

import { waitForPendingWrites } from "firebase/firestore";
import { CloudOff } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";

function subscribe(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/** `navigator.onLine`, assumed online during server rendering. */
export function useOnline() {
  return React.useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true
  );
}

/**
 * Quiet offline indicator. While offline, a small pill floats above the view
 * switcher so it's clear check-ins are being kept on this device. When the
 * connection returns, a toast confirms once Firestore has uploaded every
 * queued change.
 */
export function SyncStatus() {
  const online = useOnline();
  const { user } = useAuth();
  const wasOffline = React.useRef(false);

  React.useEffect(() => {
    if (!online) {
      wasOffline.current = true;
      return;
    }
    if (!wasOffline.current) return;
    wasOffline.current = false;

    let cancelled = false;
    waitForPendingWrites(db)
      .then(() => {
        if (!cancelled && user) toast.success("Back online · changes synced");
      })
      .catch(() => {
        // Signed out or the app is closing: nothing to confirm.
      });
    return () => {
      cancelled = true;
    };
  }, [online, user]);

  // Signed out there's nothing to keep or sync, so stay quiet.
  if (online || !user) return null;

  return (
    <div
      role="status"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+84px)] z-40 flex justify-center px-4"
    >
      <div className="material flex animate-rise items-center gap-2 rounded-full border border-black/5 py-1.5 pr-3.5 pl-3 text-[13px] font-medium text-muted-foreground shadow-[0_8px_24px_-8px_rgb(0_0_0/0.25)] dark:border-white/10">
        <CloudOff className="size-3.5" aria-hidden />
        Offline · changes will sync when you&apos;re back
      </div>
    </div>
  );
}
