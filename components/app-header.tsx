"use client";

import { Hourglass, Plus, Settings } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/wordmark";
import { nav } from "@/lib/transitions";

/** Translucent, sticky navigation bar, like a UINavigationBar. */
export function AppHeader() {
  return (
    <header className="material bar-edge pt-safe sticky top-0 z-20 -mx-4 px-4">
      <div className="grid h-14 grid-cols-[1fr_auto_1fr] items-center gap-2">
        <Button
          variant="ghost"
          size="icon-lg"
          aria-label="Settings"
          className="justify-self-start"
          nativeButton={false}
          render={<Link href="/settings" transitionTypes={nav("sheetUp")} />}
        >
          <Settings />
        </Button>
        <Wordmark className="text-xl" />
        <div className="flex items-center gap-1 justify-self-end">
          <Button
            variant="ghost"
            size="icon-lg"
            aria-label="Life in weeks"
            nativeButton={false}
            render={<Link href="/life" transitionTypes={nav("push")} />}
          >
            <Hourglass />
          </Button>
          <Button
            size="icon-lg"
            aria-label="New habit"
            nativeButton={false}
            render={
              <Link href="/habits/new" transitionTypes={nav("sheetUp")} />
            }
          >
            <Plus />
          </Button>
        </div>
      </div>
    </header>
  );
}
