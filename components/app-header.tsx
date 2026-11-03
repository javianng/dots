"use client";

import { Plus, Settings } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/wordmark";
import { nav } from "@/lib/transitions";

/** Translucent, sticky navigation bar, like a UINavigationBar. */
export function AppHeader() {
  return (
    <header className="material bar-edge pt-safe sticky top-0 z-20 -mx-4 px-4">
      <div className="flex h-14 items-center justify-between gap-2">
        <Button
          variant="ghost"
          size="icon-lg"
          aria-label="Settings"
          nativeButton={false}
          render={<Link href="/settings" transitionTypes={nav("sheetUp")} />}
        >
          <Settings />
        </Button>
        <Wordmark className="text-xl" />
        <Button
          size="icon-lg"
          aria-label="New habit"
          nativeButton={false}
          render={<Link href="/habits/new" transitionTypes={nav("sheetUp")} />}
        >
          <Plus />
        </Button>
      </div>
    </header>
  );
}
