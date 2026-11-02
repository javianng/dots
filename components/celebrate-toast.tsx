"use client";

import { toast } from "sonner";

import { currentStreak, todayKey } from "@/lib/dates";
import { haptic } from "@/lib/haptics";
import type { Habit } from "@/lib/types";
import { habitTint } from "@/lib/palette";
import { cn } from "@/lib/utils";

function subtitleFor(habit: Habit, streak: number, isToday: boolean) {
  if (habit.streakGoal && streak === habit.streakGoal) {
    return `Goal reached: ${streak}-day streak`;
  }
  if (!isToday) return "Marked as done";
  if (streak > 1) return `Done for today · ${streak}-day streak`;
  return "Done for today";
}

/**
 * Shows the top-centre "done" toast after a habit is checked off.
 * `habit` is the habit as it was before this tap; `dateKey` is the day checked.
 */
export function celebrateCompletion(habit: Habit, dateKey: string) {
  const history = { ...habit.history, [dateKey]: true };
  const streak = currentStreak(history);
  const isToday = dateKey === todayKey();
  const goalReached = !!habit.streakGoal && streak === habit.streakGoal;

  haptic(goalReached ? "success" : "light");

  toast.custom(
    () => (
      <div
        role="status"
        className="flex w-fit max-w-[min(22rem,calc(100vw-2rem))] items-center gap-3 rounded-full border border-black/5 bg-popover/80 py-2 pr-5 pl-2 text-popover-foreground shadow-[0_8px_32px_-8px_rgb(0_0_0/0.25)] backdrop-blur-xl backdrop-saturate-150 dark:border-white/10"
      >
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-full text-(--on-tint)",
            goalReached && "shadow-(--shadow-now)"
          )}
          style={{ backgroundColor: habitTint(habit.colorHex) }}
        >
          <svg
            viewBox="0 0 24 24"
            className="check-draw size-5"
            fill="none"
            stroke="currentColor"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M5 12.5l4.5 4.5L19 7.5" pathLength={1} />
          </svg>
        </span>
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="truncate text-sm font-semibold">
            {goalReached ? "Goal reached!" : habit.name}
          </span>
          <span className="truncate text-xs text-muted-foreground">
            {goalReached ? habit.name : subtitleFor(habit, streak, isToday)}
          </span>
        </span>
      </div>
    ),
    {
      // One toast per habit/day: re-checking replaces rather than stacks.
      id: `done-${habit.id}-${dateKey}`,
      duration: goalReached ? 3500 : 2200,
      unstyled: true,
      className: "flex w-full justify-center",
    }
  );
}
