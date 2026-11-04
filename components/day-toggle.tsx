"use client";

import * as React from "react";

import { Pause, Play } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { useNow } from "@/hooks/use-timer";
import { elapsedSeconds, formatClock, isTimerRunning } from "@/lib/check-in";
import { todayKey } from "@/lib/dates";
import { habitTint } from "@/lib/palette";
import { dayTarget, isScheduledDay } from "@/lib/schedule";
import type { Habit } from "@/lib/types";
import { cn } from "@/lib/utils";

function parseKey(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/**
 * The toggle for one habit on one day, wired to the habit's goal:
 * - count goals: tap ring / check (see DayToggle).
 * - time goals today: a countdown ring with play / pause in the middle.
 * - time goals on other days: a ring showing minutes logged; tap = done.
 * Unscheduled (rest) days are drawn quieter but can still be logged.
 */
export function HabitDayToggle({
  habit,
  dateKey,
  onToggle,
  label,
  className,
}: {
  habit: Habit;
  dateKey: string;
  onToggle: () => void;
  label: string;
  className?: string;
}) {
  const running = isTimerRunning(habit, dateKey);
  const now = useNow(running);
  const target = dayTarget(habit);
  const completed = !!habit.history[dateKey];
  const rest = !completed && !isScheduledDay(habit.schedule, parseKey(dateKey));
  const restClass = rest ? "opacity-40" : undefined;

  if (habit.goalType !== "time" || completed) {
    return (
      <DayToggle
        completed={completed}
        count={Math.min(habit.counts[dateKey] ?? 0, target)}
        target={habit.goalType === "time" ? 1 : target}
        colorHex={habit.colorHex}
        onToggle={onToggle}
        label={rest ? `${label} (rest day)` : label}
        className={cn(restClass, className)}
      />
    );
  }

  const seconds = elapsedSeconds(habit, dateKey, now);
  const isToday = dateKey === todayKey();
  const remaining = formatClock(target - seconds);
  return (
    <ProgressRing
      count={seconds}
      target={target}
      onTap={onToggle}
      label={
        isToday
          ? `${running ? "Pause" : "Start"} ${habit.name} timer, ${remaining} left`
          : `${label} (${Math.floor(seconds / 60)} of ${target / 60} minutes)`
      }
      className={cn(restClass, className)}
      style={{ "--habit-tint": habitTint(habit.colorHex) } as React.CSSProperties}
      center={
        isToday ? (
          running ? (
            <Pause className="size-3.5 fill-current" strokeWidth={0} />
          ) : (
            <Play className="ml-0.5 size-3.5 fill-current" strokeWidth={0} />
          )
        ) : seconds > 0 ? (
          `${Math.floor(seconds / 60)}′`
        ) : null
      }
      pulse={running}
    />
  );
}

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
  center,
  pulse,
}: {
  count: number;
  target: number;
  onTap: () => void;
  label: string;
  className?: string;
  style: React.CSSProperties;
  /** Replaces the tap count in the middle (e.g. a play / pause glyph). */
  center?: React.ReactNode;
  /** Running countdown: tints the glyph so "live" reads at a glance. */
  pulse?: boolean;
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
      <span
        className={cn(
          "text-[12px] font-semibold tabular-nums",
          pulse ? "text-(--habit-tint)" : "text-muted-foreground",
        )}
      >
        {center === undefined ? count : center}
      </span>
    </button>
  );
}
