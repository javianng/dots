"use client";

import { celebrateCompletion } from "@/components/celebrate-toast";
import { todayKey } from "@/lib/dates";
import { setDayCount, startTimer, stopTimer } from "@/lib/habits";
import { haptic } from "@/lib/haptics";
import { dayTarget } from "@/lib/schedule";
import type { Habit } from "@/lib/types";

/** Amount logged for a day (taps or seconds), capped at the habit's current target. */
export function dayCount(habit: Habit, dateKey: string): number {
  return Math.min(habit.counts[dateKey] ?? 0, dayTarget(habit));
}

/** Seconds logged for a day including a running countdown, capped at the target. */
export function elapsedSeconds(habit: Habit, dateKey: string, now = Date.now()): number {
  const target = dayTarget(habit);
  let seconds = habit.counts[dateKey] ?? 0;
  if (habit.timer && habit.timer.dateKey === dateKey) {
    seconds += Math.max(0, Math.floor((now - habit.timer.startedAt) / 1000));
  }
  return Math.min(seconds, target);
}

export function isTimerRunning(habit: Habit, dateKey?: string) {
  return !!habit.timer && (!dateKey || habit.timer.dateKey === dateKey);
}

/** "25:00", "1:05:30". */
export function formatClock(totalSeconds: number) {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

/** "25 min", "1 h 30 min". */
export function formatMinutes(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** Play: starts the countdown for today. No-op once today's time is in. */
export function playTimer(uid: string, habit: Habit) {
  const dateKey = todayKey();
  if (habit.timer || dayCount(habit, dateKey) >= dayTarget(habit)) return;
  haptic("light");
  return startTimer(uid, habit.id, { startedAt: Date.now(), dateKey });
}

/** Pause: banks the time run so far against the timer's day. */
export function pauseTimer(uid: string, habit: Habit) {
  if (!habit.timer) return;
  const { dateKey } = habit.timer;
  const seconds = elapsedSeconds(habit, dateKey);
  const target = dayTarget(habit);
  if (seconds >= target) celebrateCompletion(habit, dateKey);
  else haptic("light");
  return stopTimer(uid, habit.id, dateKey, seconds, target);
}

/** Clears a day's time (and stops the countdown if it was for that day). */
export function resetTimer(uid: string, habit: Habit, dateKey = todayKey()) {
  haptic("light");
  if (habit.timer?.dateKey === dateKey) {
    return stopTimer(uid, habit.id, dateKey, 0, dayTarget(habit));
  }
  return setDayCount(uid, habit.id, dateKey, 0, dayTarget(habit));
}

/** Marks a day fully done (time goals: fills the remaining time). */
export function completeDay(uid: string, habit: Habit, dateKey: string) {
  const target = dayTarget(habit);
  celebrateCompletion(habit, dateKey);
  if (habit.timer?.dateKey === dateKey) return stopTimer(uid, habit.id, dateKey, target, target);
  return setDayCount(uid, habit.id, dateKey, target, target);
}

/**
 * One tap on a day.
 * - Count goals: adds a tap until the target is met; a tap on a finished day
 *   clears it (so a mis-tap is one more tap away from undone).
 * - Time goals, today: play / pause the countdown (`useTimer: false` turns
 *   this into a plain done / not-done toggle, e.g. for the calendar).
 * - Time goals, other days: done / not done (past time can't be timed).
 */
export function checkIn(
  uid: string,
  habit: Habit,
  dateKey: string,
  { useTimer = true }: { useTimer?: boolean } = {}
) {
  const target = dayTarget(habit);

  if (habit.goalType === "time") {
    const done = elapsedSeconds(habit, dateKey) >= target;
    if (done) return resetTimer(uid, habit, dateKey);
    if (useTimer && dateKey === todayKey()) {
      return habit.timer ? pauseTimer(uid, habit) : playTimer(uid, habit);
    }
    return completeDay(uid, habit, dateKey);
  }

  const current = dayCount(habit, dateKey);
  const next = current >= target ? 0 : current + 1;

  if (next >= target) celebrateCompletion(habit, dateKey);
  else if (next > 0) haptic("light");

  return setDayCount(uid, habit.id, dateKey, next, target);
}
