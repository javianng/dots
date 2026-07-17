"use client";

import { LayoutGrid, List, Rows3 } from "lucide-react";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export type ViewTab = "grid" | "list" | "compact";

/** Floating pill segmented control for switching the main view. */
export function ViewSwitcher({
  value,
  onChange,
}: {
  value: ViewTab;
  onChange: (tab: ViewTab) => void;
}) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-5 flex justify-center">
      <ToggleGroup
        value={[value]}
        onValueChange={(next: unknown[]) => {
          const tab = next[0] as ViewTab | undefined;
          if (tab) onChange(tab);
        }}
        spacing={1}
        className="pointer-events-auto rounded-full border bg-card p-1 shadow-lg"
      >
        <ToggleGroupItem value="grid" aria-label="Grid view" className="rounded-full">
          <LayoutGrid />
        </ToggleGroupItem>
        <ToggleGroupItem value="list" aria-label="List view" className="rounded-full">
          <List />
        </ToggleGroupItem>
        <ToggleGroupItem value="compact" aria-label="Compact view" className="rounded-full">
          <Rows3 />
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
}
