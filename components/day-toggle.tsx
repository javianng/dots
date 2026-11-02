"use client";

import * as React from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { habitTint } from "@/lib/palette";

/**
 * Round, Reminders-style completion toggle, filled with the habit tint when
 * done. Checking it plays a small spring "pop".
 *
 * Habits with a daily target above 1 show a progress ring instead while the
 * day is unfinished: each tap fills a segment, and the last tap turns it into
 * the same filled check. Tapping a finished day clears it.
 */
export function DayToggle({
  completed,
  colorHex,
  onToggle,
  label,
  className,
  count = completed ? 1 : 0,
  target = 1,
}: {
  completed: boolean;
  colorHex: string;
  onToggle: () => void;
  label: string;
  className?: string;
  /** Taps logged for this day. */
  count?: number;
  /** Taps needed to finish the day. */
  target?: number;
}) {
  const [popping, setPopping] = React.useState(false);
  const style = { "--habit-tint": habitTint(colorHex) } as React.CSSProperties;

  if (target > 1 && !completed) {
    return (
      <ProgressRing
        count={count}
        target={target}
        onTap={onToggle}
        label={`${label} (${count} of ${target})`}
        className={className}
        style={style}
      />
    );
  }

  return (
    <Checkbox
      checked={completed}
      onCheckedChange={(checked) => {
        if (checked) setPopping(true);
        onToggle();
      }}
      onAnimationEnd={() => setPopping(false)}
      aria-label={target > 1 ? `${label} (${target} of ${target})` : label}
      className={cn(
        "border-foreground/20 size-9 rounded-full border-[1.5px] bg-transparent data-checked:border-transparent data-checked:bg-(--habit-tint) data-checked:text-(--on-tint) dark:bg-transparent dark:data-checked:bg-(--habit-tint) [&_[data-slot=checkbox-indicator]>svg]:size-[18px] [&_[data-slot=checkbox-indicator]>svg]:stroke-[3]",
        popping && "animate-pop",
        className,
      )}
      style={style}
    />
  );
}

const RING_SIZE = 36;
const STROKE = 3;
const RADIUS = (RING_SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
/** Above this many segments the gaps get too small to read; draw a plain arc. */
const MAX_SEGMENTS = 12;

function ProgressRing({
  count,
  target,
  onTap,
  label,
  className,
  style,
}: {
  count: number;
  target: number;
  onTap: () => void;
  label: string;
  className?: string;
  style: React.CSSProperties;
}) {
  const segmented = target <= MAX_SEGMENTS;
  const gap = segmented ? 4 : 0;
  const segment = CIRCUMFERENCE / target;
  // Dash pattern for the filled part: `count` segments separated by gaps, then
  // one long gap so the pattern never repeats past `count`.
  const filled = segmented
    ? Array.from(
        { length: count },
        (_, i) => `${segment - gap} ${i === count - 1 ? CIRCUMFERENCE : gap}`,
      ).join(" ")
    : `${(count / target) * CIRCUMFERENCE} ${CIRCUMFERENCE}`;
  const track = segmented ? `${segment - gap} ${gap}` : undefined;

  return (
    <button
      type="button"
      aria-label={label}
      onClick={onTap}
      className={cn(
        "focus-visible:ring-ring/30 relative flex size-9 shrink-0 items-center justify-center rounded-full transition-transform duration-200 ease-(--ease-ios) outline-none focus-visible:ring-2 active:scale-90",
        className,
      )}
      style={style}
    >
      <svg
        viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
        className="absolute inset-0 size-full -rotate-90"
        aria-hidden
      >
        <circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RADIUS}
          fill="none"
          strokeWidth={STROKE}
          strokeDasharray={track}
          strokeDashoffset={-gap / 2}
          className="stroke-foreground/15"
        />
        {count > 0 && (
          <circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RADIUS}
            fill="none"
            strokeWidth={STROKE}
            strokeLinecap={segmented ? "butt" : "round"}
            strokeDasharray={filled}
            strokeDashoffset={-gap / 2}
            className="stroke-(--habit-tint) transition-[stroke-dasharray] duration-300 ease-(--ease-ios)"
          />
        )}
      </svg>
      <span className="text-muted-foreground text-[12px] font-semibold tabular-nums">
        {count}
      </span>
    </button>
  );
}
