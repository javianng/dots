"use client";

import * as React from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

/** Checkbox-style completion toggle, filled with the habit tint when done. */
export function DayToggle({
  completed,
  colorHex,
  onToggle,
  label,
  className,
}: {
  completed: boolean;
  colorHex: string;
  onToggle: () => void;
  label: string;
  className?: string;
}) {
  return (
    <Checkbox
      checked={completed}
      onCheckedChange={onToggle}
      aria-label={label}
      className={cn(
        "size-8 rounded-lg data-checked:border-transparent data-checked:bg-(--habit-tint) data-checked:text-white dark:data-checked:bg-(--habit-tint)",
        className
      )}
      style={{ "--habit-tint": colorHex } as React.CSSProperties}
    />
  );
}
