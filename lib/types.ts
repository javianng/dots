/**
 * How often a habit is meant to happen.
 * - daily: every day (the original behaviour).
 * - days: on fixed weekdays only (0 = Sunday … 6 = Saturday).
 * - period: any `times` days within each week (Mon–Sun) or calendar month.
 * - interval: once every `every` days, counted from the last time it was done.
 */
export type Schedule =
  | { type: "daily" }
  | { type: "days"; days: number[] }
  | { type: "period"; period: "week" | "month"; times: number }
  | { type: "interval"; every: number };

/**
 * What finishes a day.
 * - count: `completionsPerDay` taps (one per time of day when several are set).
 * - amount: reach `amountTarget` of `amountUnit`, each tap adds `amountStep`.
 * - time: `durationMinutes` of focused time, logged with a play/pause countdown.
 * - limit: stay at or under `amountTarget` (each tap logs `amountStep`).
 */
export type GoalType = "count" | "amount" | "time" | "limit";

export type DayPart = "morning" | "afternoon" | "evening";

/** A running countdown: when it was (re)started and which day it logs to. */
export interface RunningTimer {
  startedAt: number;
  dateKey: string;
}

export interface HabitSettings {
  name: string;
  description: string;
  icon: string;
  colorHex: string;
  streakGoal: number | null;
  goalType: GoalType;
  /** Taps needed to finish a day. 1 = a simple check-off. */
  completionsPerDay: number;
  /** Minutes needed to finish a day (time goals). */
  durationMinutes: number;
  /** Amount goals: the daily target. Limit goals: the daily maximum (may be 0). */
  amountTarget: number;
  /** "ml", "pages", "coffees"… empty for plain counts. */
  amountUnit: string;
  /** How much one quick tap logs. */
  amountStep: number;
  schedule: Schedule;
  /** When in the day it happens; empty = any time. */
  parts: DayPart[];
}

export type HabitDraft = HabitSettings;

export interface Habit extends Omit<HabitSettings, "icon"> {
  id: string;
  icon?: string;
  /** Set while the countdown is playing; null when paused or idle. */
  timer: RunningTimer | null;
  createdAt: number;
  /** 'YYYY-MM-DD' → the day's goal is met (limit goals: kept under the limit). */
  history: Record<string, boolean>;
  /**
   * 'YYYY-MM-DD' → amount logged that day (only days with some): taps for
   * count goals, seconds for time goals, units for amount and limit goals.
   */
  counts: Record<string, number>;
  /** Days marked as skipped (sick, travelling): they neither count nor break streaks. */
  skipped: Record<string, true>;
  /** Times of day ticked off, for check-off habits with several times of day. */
  slots: Record<string, DayPart[]>;
}
