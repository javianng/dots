"use client";

import { celebrateCompletion } from "@/components/celebrate-toast";
import { setDayCount } from "@/lib/habits";
import { haptic } from "@/lib/haptics";
import type { Habit } from "@/lib/types";

/** Taps logged for a day, capped at the habit's current target. */
export function dayCount(habit: Habit, dateKey: string): number {
  return Math.min(habit.counts[dateKey] ?? 0, habit.completionsPerDay);
}

/**
 * One tap on a day: adds a tap until the daily target is met, and a tap on a
 * finished day clears it (so a mis-tap is one more tap away from undone).
 * For a 1× habit this is the same check / uncheck as before.
 */
export function checkIn(uid: string, habit: Habit, dateKey: string) {
  const target = habit.completionsPerDay;
  const current = dayCount(habit, dateKey);
  const next = current >= target ? 0 : current + 1;

  if (next >= target) celebrateCompletion(habit, dateKey);
  else if (next > 0) haptic("light");

  return setDayCount(uid, habit.id, dateKey, next, target);
}
