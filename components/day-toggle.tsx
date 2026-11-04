"use client";

import * as React from "react";

import { Minus, Pause, Play } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { useNow } from "@/hooks/use-timer";
import { elapsedSeconds, formatClock, isTimerRunning, usesSlots } from "@/lib/check-in";
import { todayKey } from "@/lib/dates";
import { habitTint } from "@/lib/palette";
import { dayTarget, isScheduledDay, parseKey, todayStatus } from "@/lib/schedule";
import type { DayPart, Habit } from "@/lib/types";
import { cn } from "@/lib/utils";

/** "750", "1.5k" — fits inside a 36px ring. */
function compact(n: number) {
  if (n >= 10000) return `${Math.round(n / 1000)}k`;
  if (n >= 1000) return `${Math.round(n / 100) / 10}k`;
  return String(Math.round(n * 10) / 10);
}

/**
 * The toggle for one habit on one day, wired to the habit's goal:
 * - check off: tap ring / check (see DayToggle). With several times of day,
 *   `part` makes it the check for just that time.
 * - amount: a ring filling in steps; each tap adds one step.
 * - limit: a ring filling towards the limit; it turns ink once you're over.
 * - timer, today: a countdown ring with play / pause in the middle.
 * - timer, other days: a ring showing minutes logged; tap = done.
 * Rest days are drawn quieter but can still be logged; skipped days show a dash.
 */
export function HabitDayToggle({
  habit,
  dateKey,
  onToggle,
  label,
  className,
  part,
}: {
  habit: Habit;
  dateKey: string;
  onToggle: () => void;
  label: string;
  className?: string;
  part?: DayPart;
}) {
  const running = isTimerRunning(habit, dateKey);
  const now = useNow(running);
  const target = dayTarget(habit);
  const logged = habit.counts[dateKey] ?? 0;
  const completed = !!habit.history[dateKey];
  const rest =
    !completed &&
    (!isScheduledDay(habit.schedule, parseKey(dateKey)) ||
      (dateKey === todayKey() && todayStatus(habit) === "rest"));
  const restClass = rest ? "opacity-40" : undefined;
  const style = { "--habit-tint": habitTint(habit.colorHex) } as React.CSSProperties;

  if (habit.skipped[dateKey]) {
    return (
      <button
        type="button"
        aria-label={`${label} (skipped)`}
        onClick={onToggle}
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-full border-[1.5px] border-dashed border-foreground/25 text-muted-foreground transition-transform duration-200 ease-(--ease-ios) active:scale-90",
          className
        )}
      >
        <Minus className="size-4" />
      </button>
    );
  }

  if (part && usesSlots(habit)) {
    return (
      <DayToggle
        completed={(habit.slots[dateKey] ?? []).includes(part)}
        colorHex={habit.colorHex}
        onToggle={onToggle}
        label={label}
        className={cn(restClass, className)}
      />
    );
  }

  if (habit.goalType === "limit") {
    const over = logged > target;
    return (
      <ProgressRing
        count={over || target === 0 ? (logged > 0 ? 1 : 0) : logged}
        target={over || target === 0 ? 1 : target}
        onTap={onToggle}
        label={`${label}: log one (${logged} of at most ${target})`}
        className={className}
        style={style}
        center={compact(logged)}
        tone={over ? "over" : undefined}
      />
    );
  }

  if (habit.goalType === "amount" && !completed) {
    // Draw in steps (2,000 ml in 250 ml taps = 8 segments) when that reads well.
    const steps = Math.ceil(target / habit.amountStep);
    return (
      <ProgressRing
        count={Math.min(steps, Math.floor(logged / habit.amountStep))}
        target={steps}
        onTap={onToggle}
        label={`${label}: add ${habit.amountStep}${habit.amountUnit ? ` ${habit.amountUnit}` : ""} (${logged} of ${target})`}
        className={cn(restClass, className)}
        style={style}
        center={compact(logged)}
      />
    );
  }

  if (habit.goalType !== "time" || completed) {
    return (
      <DayToggle
        completed={completed}
        count={Math.min(logged, target)}
        target={habit.goalType === "count" ? target : 1}
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
      style={style}
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
      tone={running ? "live" : undefined}
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
  tone,
}: {
  count: number;
  target: number;
  onTap: () => void;
  label: string;
  className?: string;
  style: React.CSSProperties;
  /** Replaces the tap count in the middle (e.g. a play / pause glyph). */
  center?: React.ReactNode;
  /** live: running countdown (tinted glyph). over: past a limit (ink ring). */
  tone?: "live" | "over";
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
            className={cn(
              "transition-[stroke-dasharray] duration-300 ease-(--ease-ios)",
              tone === "over" ? "stroke-foreground" : "stroke-(--habit-tint)",
            )}
          />
        )}
      </svg>
      <span
        className={cn(
          "text-[12px] font-semibold tabular-nums",
          tone === "live"
            ? "text-(--habit-tint)"
            : tone === "over"
              ? "text-foreground"
              : "text-muted-foreground",
        )}
      >
        {center === undefined ? count : center}
      </span>
    </button>
  );
}
