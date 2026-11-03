import { WifiOff } from "lucide-react";

import { Wordmark } from "@/components/wordmark";

export const metadata = { title: "Offline · dots" };

/** Shown by the service worker for a page that isn't cached yet. */
export default function OfflinePage() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <Wordmark className="text-2xl" />
      <WifiOff className="size-8 text-muted-foreground" aria-hidden />
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold tracking-tight">You&apos;re offline</h1>
        <p className="text-[15px] text-muted-foreground">
          This page hasn&apos;t been saved for offline use yet. Your habits are still on
          this device. Head back to Today to keep checking in.
        </p>
      </div>
      {/* Plain link: a full load lets the service worker serve the cached page. */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a href="/" className="tappable rounded-full bg-foreground px-5 py-2.5 text-[15px] font-semibold text-background">
        Go to Today
      </a>
    </main>
  );
}
