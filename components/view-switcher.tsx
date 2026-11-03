"use client";

import { Hourglass, LayoutGrid, List, Rows3, type LucideIcon } from "lucide-react";
import * as React from "react";

import { haptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";

export type ViewTab = "grid" | "list" | "compact" | "life";

const TABS: { value: ViewTab; label: string; Icon: LucideIcon }[] = [
  { value: "grid", label: "Grid view", Icon: LayoutGrid },
  { value: "list", label: "List view", Icon: List },
  { value: "compact", label: "Compact view", Icon: Rows3 },
  { value: "life", label: "Life in weeks", Icon: Hourglass },
];

/** Position of a tab in the switcher, used to pick the slide direction. */
export function tabIndex(tab: ViewTab): number {
  return Math.max(
    0,
    TABS.findIndex((t) => t.value === tab)
  );
}

/**
 * Floating glass segmented control. The selection thumb glides between
 * segments on a spring, like UISegmentedControl.
 */
export function ViewSwitcher({
  value,
  onChange,
}: {
  value: ViewTab;
  onChange: (tab: ViewTab) => void;
}) {
  const index = tabIndex(value);

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center pb-[calc(env(safe-area-inset-bottom)+16px)]"
      style={{ viewTransitionName: "view-switcher" }}
    >
      <div
        role="radiogroup"
        aria-label="Layout"
        className="material-thick pointer-events-auto relative grid grid-cols-4 rounded-full p-1 shadow-[0_8px_30px_-6px_oklch(0_0_0/0.22)] ring-1 ring-black/5 dark:ring-white/10"
      >
        <span
          aria-hidden="true"
          className="absolute top-1 bottom-1 left-1 w-12 rounded-full bg-background shadow-[0_1px_3px_oklch(0_0_0/0.12)] transition-transform duration-500 ease-(--ease-spring) dark:bg-white/15"
          style={{ transform: `translateX(${index * 100}%)` }}
        />
        {TABS.map(({ value: tab, label, Icon }) => {
          const selected = tab === value;
          return (
            <button
              key={tab}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={label}
              onClick={() => {
                if (selected) return;
                haptic();
                onChange(tab);
              }}
              className={cn(
                "relative z-10 flex h-10 w-12 items-center justify-center rounded-full transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                selected ? "text-foreground" : "text-muted-foreground"
              )}
            >
              <Icon className="size-[18px]" strokeWidth={selected ? 2.25 : 2} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
