/**
 * How often a habit is meant to happen.
 * - daily: every day (the original behaviour).
 * - days: on fixed weekdays only (0 = Sunday … 6 = Saturday).
 * - period: any `times` days within each week (Mon–Sun) or calendar month.
 */
export type Schedule =
  | { type: "daily" }
  | { type: "days"; days: number[] }
  | { type: "period"; period: "week" | "month"; times: number };

/**
 * What finishes a day.
 * - count: `completionsPerDay` taps.
 * - time: `durationMinutes` of focused time, logged with a play/pause countdown.
 */
export type GoalType = "count" | "time";

/** A running countdown: when it was (re)started and which day it logs to. */
export interface RunningTimer {
  startedAt: number;
  dateKey: string;
}

export interface Habit {
  id: string;
  name: string;
  description: string;
  icon?: string;
  colorHex: string;
  streakGoal: number | null;
  goalType: GoalType;
  /** Taps needed to finish a day. 1 = a simple check-off. */
  completionsPerDay: number;
  /** Minutes needed to finish a day (time goals). */
  durationMinutes: number;
  schedule: Schedule;
  /** Set while the countdown is playing; null when paused or idle. */
  timer: RunningTimer | null;
  createdAt: number;
  /** 'YYYY-MM-DD' → completed (count reached the daily target). */
  history: Record<string, boolean>;
  /**
   * 'YYYY-MM-DD' → amount logged that day (only days with some): taps for
   * count goals, seconds for time goals.
   */
  counts: Record<string, number>;
}

export interface HabitDraft {
  name: string;
  description: string;
  icon: string;
  colorHex: string;
  streakGoal: number | null;
  goalType: GoalType;
  completionsPerDay: number;
  durationMinutes: number;
  schedule: Schedule;
}
