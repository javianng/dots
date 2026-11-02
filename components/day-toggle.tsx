"use client";

import * as React from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { habitTint } from "@/lib/palette";

/**
 * Round, Reminders-style completion toggle, filled with the habit tint when
 * done. Checking it plays a small spring "pop".
 */
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
  const [popping, setPopping] = React.useState(false);

  return (
    <Checkbox
      checked={completed}
      onCheckedChange={(checked) => {
        if (checked) setPopping(true);
        onToggle();
      }}
      onAnimationEnd={() => setPopping(false)}
      aria-label={label}
      className={cn(
        "size-9 rounded-full border-[1.5px] border-foreground/20 bg-transparent dark:bg-transparent data-checked:border-transparent data-checked:bg-(--habit-tint) data-checked:text-(--on-tint) dark:data-checked:bg-(--habit-tint) [&_[data-slot=checkbox-indicator]>svg]:size-[18px] [&_[data-slot=checkbox-indicator]>svg]:stroke-[3]",
        popping && "animate-pop",
        className
      )}
      style={{ "--habit-tint": habitTint(colorHex) } as React.CSSProperties}
    />
  );
}
