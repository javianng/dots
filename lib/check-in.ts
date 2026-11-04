"use client";

import { celebrateCompletion } from "@/components/celebrate-toast";
import { todayKey } from "@/lib/dates";
import { setDayCount, setSkipped, startTimer, stopTimer } from "@/lib/habits";
import { haptic } from "@/lib/haptics";
import { dayTarget, isDayMet } from "@/lib/schedule";
import type { DayPart, Habit } from "@/lib/types";

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

/** Check-off habits with several times of day get one check per time of day. */
export function usesSlots(habit: Habit) {
  return habit.goalType === "count" && habit.parts.length > 1;
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
  return stopTimer(uid, habit.id, dateKey, seconds, seconds >= target);
}

/** Clears a day (and stops the countdown if it was running for that day). */
export function clearDay(uid: string, habit: Habit, dateKey = todayKey()) {
  haptic("light");
  if (habit.timer?.dateKey === dateKey) {
    return stopTimer(uid, habit.id, dateKey, 0, false);
  }
  return setDayCount(uid, habit.id, dateKey, 0, false);
}

/** Marks a day fully done (time goals: fills the remaining time). */
export function completeDay(uid: string, habit: Habit, dateKey: string) {
  const target = dayTarget(habit);
  celebrateCompletion(habit, dateKey);
  if (habit.timer?.dateKey === dateKey) return stopTimer(uid, habit.id, dateKey, target, true);
  return setDayCount(
    uid,
    habit.id,
    dateKey,
    target,
    true,
    usesSlots(habit) ? [...habit.parts] : undefined
  );
}

/**
 * Sets a day's logged amount (amount, limit and count goals). Celebrates
 * when an amount goal is reached; a limit gets a gentle heads-up instead.
 */
export function setAmount(uid: string, habit: Habit, dateKey: string, value: number) {
  const next = Math.max(0, Math.round(value * 100) / 100);
  const before = habit.counts[dateKey] ?? 0;
  const met = isDayMet(habit, next);
  if (habit.goalType !== "limit" && met && !isDayMet(habit, before)) {
    celebrateCompletion(habit, dateKey);
  } else {
    haptic("light");
  }
  return setDayCount(uid, habit.id, dateKey, next, met);
}

/** Ticks one time of day on or off (check-off habits with several times of day). */
export function toggleSlot(uid: string, habit: Habit, dateKey: string, part: DayPart) {
  const done = new Set(habit.slots[dateKey] ?? []);
  if (done.has(part)) done.delete(part);
  else done.add(part);
  const slots = habit.parts.filter((p) => done.has(p));
  const complete = slots.length >= habit.parts.length;
  if (complete) celebrateCompletion(habit, dateKey);
  else haptic("light");
  return setDayCount(uid, habit.id, dateKey, slots.length, complete, slots);
}

export function toggleSkip(uid: string, habit: Habit, dateKey: string) {
  haptic("light");
  const skip = !habit.skipped[dateKey];
  if (skip && habit.timer?.dateKey === dateKey) {
    return stopTimer(uid, habit.id, dateKey, 0, false).then(() =>
      setSkipped(uid, habit.id, dateKey, true)
    );
  }
  return setSkipped(uid, habit.id, dateKey, skip);
}

/**
 * One quick tap on a day (the round toggles on the main screen).
 * - Check-off goals: adds a tap until the target is met; a tap on a finished
 *   day clears it (so a mis-tap is one more tap away from undone). With
 *   several times of day, `part` picks which check to toggle.
 * - Amount / limit goals: adds one step. Corrections live on the habit page.
 * - Time goals, today: play / pause the countdown (`useTimer: false` turns
 *   this into a plain done / not-done toggle).
 * - Time goals, other days: done / not done (past time can't be timed).
 */
export function checkIn(
  uid: string,
  habit: Habit,
  dateKey: string,
  { useTimer = true, part }: { useTimer?: boolean; part?: DayPart } = {}
) {
  const target = dayTarget(habit);

  if (habit.goalType === "amount" || habit.goalType === "limit") {
    return setAmount(uid, habit, dateKey, (habit.counts[dateKey] ?? 0) + habit.amountStep);
  }

  if (habit.goalType === "time") {
    const done = elapsedSeconds(habit, dateKey) >= target;
    if (done) return clearDay(uid, habit, dateKey);
    if (useTimer && dateKey === todayKey()) {
      return habit.timer ? pauseTimer(uid, habit) : playTimer(uid, habit);
    }
    return completeDay(uid, habit, dateKey);
  }

  if (usesSlots(habit)) {
    if (part) return toggleSlot(uid, habit, dateKey, part);
    // No specific time of day (e.g. the 5-day list): fill the next one, or clear.
    const done = new Set(habit.slots[dateKey] ?? []);
    if (done.size >= habit.parts.length) return clearDay(uid, habit, dateKey);
    const next = habit.parts.find((p) => !done.has(p))!;
    return toggleSlot(uid, habit, dateKey, next);
  }

  const current = dayCount(habit, dateKey);
  const next = current >= target ? 0 : current + 1;

  if (next >= target) celebrateCompletion(habit, dateKey);
  else if (next > 0) haptic("light");

  return setDayCount(uid, habit.id, dateKey, next, next >= target);
}
