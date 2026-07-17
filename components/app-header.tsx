"use client";

import { Plus, Settings } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/wordmark";

export function AppHeader() {
  return (
    <header className="flex items-center justify-between gap-2 py-3">
      <Button
        variant="ghost"
        size="icon-lg"
        aria-label="Settings"
        nativeButton={false}
        render={<Link href="/settings" />}
      >
        <Settings />
      </Button>
      <Wordmark className="text-xl" />
      <div className="flex items-center gap-1.5">

        <Button
          size="icon-lg"
          className="rounded-full"
          aria-label="New habit"
          nativeButton={false}
          render={<Link href="/habits/new" />}
        >
          <Plus />
        </Button>
      </div>
    </header>
  );
}
