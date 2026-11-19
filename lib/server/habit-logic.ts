/**
 * Pure habit rules for the MCP server: building and checking habit settings,
 * planning what a log action writes, and describing habits for an agent.
 * Mirrors components/habit-form.tsx and lib/check-in.ts so the agent and the
 * app agree on what every action means. No Firestore here, so it's testable.
 */
import { HABIT_COLORS } from "@/lib/palette";
import { HABIT_ICON_KEYS, resolveHabitIconKey } from "@/lib/habit-icons";
import {
  DAILY,
  dayTarget,
  goalLabel,
  habitStreak,
  isDayMet,
  MAX_INTERVAL,
  MAX_TIMES,
  partsLabel,
  progressLabel,
  scheduleLabel,
  streakPhrase,
  todayStatus,
  withUnit,
} from "@/lib/schedule";
import { addDays, toDateKey } from "@/lib/dates";
import type { DayPart, GoalType, Habit, HabitDraft, Schedule } from "@/lib/types";

// --- Time zones -------------------------------------------------------------
//
// lib/schedule.ts reads a Date's local fields (getDay, getDate…). The server
// runs in UTC, so habits are evaluated on a "wall clock" Date whose local
// fields show the user's own time.

function zonedParts(date: Date, timeZone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value])
  );
  return {
    y: Number(parts.year),
    m: Number(parts.month),
    d: Number(parts.day),
    h: Number(parts.hour),
    min: Number(parts.minute),
    s: Number(parts.second),
  };
}

/** A Date whose local fields read as the user's wall-clock time at `date`. */
export function wallClock(date: Date, timeZone: string): Date {
  const p = zonedParts(date, timeZone);
  return new Date(p.y, p.m - 1, p.d, p.h, p.min, p.s);
}

/** 'YYYY-MM-DD' of `date` in `timeZone`. */
export function dateKeyIn(date: Date, timeZone: string): string {
  return toDateKey(wallClock(date, timeZone));
}

export function isValidTimeZone(tz: unknown): tz is string {
  if (typeof tz !== "string" || !tz) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

// --- Settings ---------------------------------------------------------------

export const COLOR_NAMES = HABIT_COLORS.map((c) => c.key) as [string, ...string[]];
export const ICON_NAMES = HABIT_ICON_KEYS as [string, ...string[]];
export const WEEKDAY_NAMES = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
export type WeekdayName = (typeof WEEKDAY_NAMES)[number];

const MAX_DAILY_TARGET = 20;
const MAX_DURATION_MINUTES = 24 * 60;
const MAX_NAME = 80;
const MAX_UNIT = 12;

/** Schedule as the agent writes it (weekday names instead of numbers). */
export type ScheduleInput =
  | { type: "daily" }
  | { type: "days"; days: WeekdayName[] }
  | { type: "period"; period: "week" | "month"; times: number }
  | { type: "interval"; every: number };

/** Habit settings as the agent writes them. Every field is optional on update. */
export interface HabitInput {
  name?: string;
  description?: string;
  icon?: string;
  color?: string;
  streak_goal?: number | null;
  goal_type?: GoalType;
  times_per_day?: number;
  minutes?: number;
  amount_target?: number;
  amount_unit?: string;
  amount_step?: number;
  schedule?: ScheduleInput;
  times_of_day?: DayPart[];
}

export class HabitInputError extends Error {}

const BLANK: HabitDraft = {
  name: "",
  description: "",
  icon: HABIT_ICON_KEYS[0],
  colorHex: HABIT_COLORS[0].hex,
  streakGoal: null,
  goalType: "count",
  completionsPerDay: 1,
  durationMinutes: 15,
  amountTarget: 1,
  amountUnit: "",
  amountStep: 1,
  schedule: DAILY,
  parts: [],
};

export function colorName(hex: string): string {
  return HABIT_COLORS.find((c) => c.hex.toLowerCase() === hex.toLowerCase())?.key ?? hex;
}

function scheduleFromInput(input: ScheduleInput): Schedule {
  switch (input.type) {
    case "days": {
      const days = [...new Set(input.days.map((d) => WEEKDAY_NAMES.indexOf(d)))].filter(
        (d) => d >= 0
      );
      if (days.length === 0) throw new HabitInputError("Pick at least one day for a days schedule.");
      return days.length === 7 ? DAILY : { type: "days", days: days.sort() };
    }
    case "period": {
      const max = MAX_TIMES[input.period];
      if (!Number.isInteger(input.times) || input.times < 1 || input.times > max) {
        throw new HabitInputError(`times must be a whole number from 1 to ${max} a ${input.period}.`);
      }
      return { type: "period", period: input.period, times: input.times };
    }
    case "interval":
      if (!Number.isInteger(input.every) || input.every < 2 || input.every > MAX_INTERVAL) {
        throw new HabitInputError(`every must be a whole number from 2 to ${MAX_INTERVAL} days.`);
      }
      return { type: "interval", every: input.every };
    default:
      return DAILY;
  }
}

/**
 * Applies agent input on top of `base` (a new habit's defaults, or the
 * current settings on update) and checks it like the habit form does.
 */
export function buildDraft(input: HabitInput, base: HabitDraft = BLANK): HabitDraft {
  const draft: HabitDraft = { ...base, schedule: base.schedule, parts: [...base.parts] };

  if (input.name !== undefined) draft.name = input.name.trim();
  if (input.description !== undefined) draft.description = input.description.trim();
  if (input.icon !== undefined) {
    if (!HABIT_ICON_KEYS.includes(input.icon)) throw new HabitInputError(`Unknown icon "${input.icon}".`);
    draft.icon = input.icon;
  }
  if (input.color !== undefined) {
    const color = HABIT_COLORS.find((c) => c.key === input.color);
    if (!color) throw new HabitInputError(`Unknown color "${input.color}".`);
    draft.colorHex = color.hex;
  }
  if (input.streak_goal !== undefined) {
    const goal = input.streak_goal;
    if (goal !== null && (!Number.isInteger(goal) || goal < 1)) {
      throw new HabitInputError("streak_goal must be a whole number above 0, or null.");
    }
    draft.streakGoal = goal;
  }
  if (input.goal_type !== undefined) draft.goalType = input.goal_type;
  if (input.times_per_day !== undefined) {
    if (!Number.isInteger(input.times_per_day) || input.times_per_day < 1 || input.times_per_day > MAX_DAILY_TARGET) {
      throw new HabitInputError(`times_per_day must be a whole number from 1 to ${MAX_DAILY_TARGET}.`);
    }
    draft.completionsPerDay = input.times_per_day;
  }
  if (input.minutes !== undefined) {
    if (!Number.isInteger(input.minutes) || input.minutes < 1 || input.minutes > MAX_DURATION_MINUTES) {
      throw new HabitInputError(`minutes must be a whole number from 1 to ${MAX_DURATION_MINUTES}.`);
    }
    draft.durationMinutes = input.minutes;
  }
  if (input.amount_target !== undefined) draft.amountTarget = input.amount_target;
  if (input.amount_unit !== undefined) draft.amountUnit = input.amount_unit.trim();
  if (input.amount_step !== undefined) draft.amountStep = input.amount_step;
  if (input.schedule !== undefined) draft.schedule = scheduleFromInput(input.schedule);
  if (input.times_of_day !== undefined) {
    draft.parts = (["morning", "afternoon", "evening"] as DayPart[]).filter((p) =>
      input.times_of_day!.includes(p)
    );
  }

  // Same rules as the habit form.
  if (!draft.name) throw new HabitInputError("Give the habit a name.");
  if (draft.name.length > MAX_NAME) throw new HabitInputError(`Keep the name under ${MAX_NAME} characters.`);
  if (draft.amountUnit.length > MAX_UNIT) {
    throw new HabitInputError(`Keep amount_unit to ${MAX_UNIT} characters or fewer.`);
  }
  if (draft.goalType === "amount" && !(draft.amountTarget > 0)) {
    throw new HabitInputError("Set amount_target above 0 for an amount goal.");
  }
  if (draft.goalType === "limit" && !(draft.amountTarget >= 0)) {
    throw new HabitInputError("Set amount_target (the daily limit) to 0 or more.");
  }
  if (!(draft.amountStep > 0)) throw new HabitInputError("amount_step must be above 0.");
  if (draft.goalType !== "count" && draft.parts.length > 1) {
    throw new HabitInputError("Only check-off (count) habits can have more than one time of day.");
  }
  // One check per time of day when several are picked.
  if (draft.goalType === "count" && draft.parts.length > 1) {
    draft.completionsPerDay = draft.parts.length;
  }
  return draft;
}

/** The settings part of a habit (what buildDraft edits). */
export function habitSettings(habit: Habit): HabitDraft {
  return {
    name: habit.name,
    description: habit.description,
    icon: resolveHabitIconKey(habit.icon, habit.id),
    colorHex: habit.colorHex,
    streakGoal: habit.streakGoal,
    goalType: habit.goalType,
    completionsPerDay: habit.completionsPerDay,
    durationMinutes: habit.durationMinutes,
    amountTarget: habit.amountTarget,
    amountUnit: habit.amountUnit,
    amountStep: habit.amountStep,
    schedule: habit.schedule,
    parts: habit.parts,
  };
}

/**
 * When the goal type changes, what a day's count means changes too. Like the
 * habit form: finished days stay finished at the new target, part-done days
 * are cleared, and switching to or from a limit clears logged days.
 */
export function rescalePlan(before: Habit, after: HabitDraft) {
  if (before.goalType === after.goalType) return null;
  const fromLimit = before.goalType === "limit";
  const days = fromLimit
    ? Object.fromEntries(Object.keys(before.counts).map((k) => [k, false]))
    : before.history;
  return { days, target: dayTarget(after), keepDone: !fromLimit && after.goalType !== "limit" };
}

// --- Logging ----------------------------------------------------------------

export type LogAction = "complete" | "add" | "set" | "clear" | "skip" | "unskip";

/** What a log action writes for one day. */
export type DayWrite =
  | { kind: "set"; count: number; completed: boolean; slots?: DayPart[] }
  | { kind: "delete" }
  | { kind: "skip" };

export interface LogPlan {
  write: DayWrite;
  /** Stop the habit's countdown (it was running for this day). */
  stopTimer: boolean;
}

function usesSlots(habit: Habit) {
  return habit.goalType === "count" && habit.parts.length > 1;
}

/** What's logged for a day, in stored units (taps, seconds, units), incl. a running countdown. */
export function loggedCount(habit: Habit, dateKey: string, nowMs: number): number {
  let count = habit.counts[dateKey] ?? 0;
  if (habit.goalType === "time" && habit.timer?.dateKey === dateKey) {
    count += Math.max(0, Math.floor((nowMs - habit.timer.startedAt) / 1000));
  }
  return count;
}

/** Converts an agent amount to stored units: minutes → seconds for time goals. */
function toStored(habit: Habit, amount: number) {
  return habit.goalType === "time" ? Math.round(amount * 60) : amount;
}

function capped(habit: Habit, count: number) {
  const value = Math.max(0, Math.round(count * 100) / 100);
  // Taps and time can't go past the day's target in the app; amounts can.
  return habit.goalType === "count" || habit.goalType === "time" ? Math.min(value, dayTarget(habit)) : value;
}

function setWrite(habit: Habit, count: number): DayWrite {
  return count <= 0 ? { kind: "delete" } : { kind: "set", count, completed: isDayMet(habit, count) };
}

/**
 * Plans one log action on one day, by the app's rules (lib/check-in.ts).
 * `amount` is in taps (count), minutes (time) or the habit's unit (amount,
 * limit). `part` picks a time of day on check-off habits that have several.
 */
export function planLog(
  habit: Habit,
  dateKey: string,
  action: LogAction,
  { amount, part, nowMs = Date.now() }: { amount?: number; part?: DayPart; nowMs?: number } = {}
): LogPlan {
  const timerOnDay = habit.timer?.dateKey === dateKey;
  const plan = (write: DayWrite): LogPlan => ({ write, stopTimer: timerOnDay });
  const target = dayTarget(habit);

  if (part && !usesSlots(habit)) {
    throw new HabitInputError(
      `"${habit.name}" doesn't have separate times of day to check off; leave out part.`
    );
  }
  if (part && !habit.parts.includes(part)) {
    throw new HabitInputError(`"${habit.name}" isn't set for the ${part}.`);
  }

  switch (action) {
    case "clear":
      return plan({ kind: "delete" });
    case "skip":
      return plan({ kind: "skip" });
    case "unskip":
      if (!habit.skipped[dateKey]) throw new HabitInputError(`${dateKey} isn't skipped.`);
      return plan({ kind: "delete" });
    case "complete": {
      if (habit.goalType === "limit") {
        throw new HabitInputError(
          `"${habit.name}" is a limit: log what was used with add or set (days with nothing logged already count as kept).`
        );
      }
      if (usesSlots(habit)) {
        const done = new Set(part ? [...(habit.slots[dateKey] ?? []), part] : habit.parts);
        const slots = habit.parts.filter((p) => done.has(p));
        return plan({ kind: "set", count: slots.length, completed: slots.length >= habit.parts.length, slots });
      }
      return plan({ kind: "set", count: target, completed: true });
    }
    case "add":
    case "set": {
      if (amount === undefined || !Number.isFinite(amount)) {
        throw new HabitInputError(`${action} needs an amount.`);
      }
      if (usesSlots(habit)) {
        throw new HabitInputError(
          `"${habit.name}" is checked off once per time of day: use complete (with part for one time of day) or clear.`
        );
      }
      const base = action === "add" ? loggedCount(habit, dateKey, nowMs) : 0;
      return plan(setWrite(habit, capped(habit, base + toStored(habit, amount))));
    }
  }
}

// --- Describing habits ------------------------------------------------------

/** A stored day count in the agent's units ("2 of 3", "12 of 25 min", "750 ml"). */
function describeCount(habit: Habit, count: number) {
  switch (habit.goalType) {
    case "time":
      return `${Math.round((count / 60) * 10) / 10} of ${habit.durationMinutes} min`;
    case "amount":
      return `${withUnit(count, habit.amountUnit)} of ${withUnit(habit.amountTarget, habit.amountUnit)}`;
    case "limit":
      return `${withUnit(count, habit.amountUnit)} (limit ${withUnit(habit.amountTarget, habit.amountUnit)})`;
    default:
      return `${count} of ${habit.completionsPerDay}`;
  }
}

function describeSchedule(schedule: Schedule): ScheduleInput {
  if (schedule.type === "days") return { type: "days", days: schedule.days.map((d) => WEEKDAY_NAMES[d]) };
  return schedule;
}

/** One day for the agent. */
export function describeDay(habit: Habit, dateKey: string, nowMs: number) {
  const count = loggedCount(habit, dateKey, nowMs);
  return {
    date: dateKey,
    done: !!habit.history[dateKey],
    skipped: !!habit.skipped[dateKey],
    logged: habit.skipped[dateKey] ? "skipped" : describeCount(habit, count),
    ...(habit.slots[dateKey]?.length ? { times_of_day_done: habit.slots[dateKey] } : {}),
    ...(habit.timer?.dateKey === dateKey ? { timer_running: true } : {}),
  };
}

/** A habit summary, evaluated at the user's wall-clock time `wallNow`. */
export function describeHabit(habit: Habit, wallNow: Date, nowMs: number) {
  const today = toDateKey(wallNow);
  const streak = habitStreak(habit, wallNow);
  return {
    id: habit.id,
    name: habit.name,
    ...(habit.description ? { description: habit.description } : {}),
    goal: goalLabel(habit),
    schedule: scheduleLabel(habit.schedule),
    times_of_day: partsLabel(habit.parts),
    today: {
      status: todayStatus(habit, wallNow),
      progress: progressLabel(habit, wallNow),
      ...describeDay(habit, today, nowMs),
    },
    streak: streak.value > 0 ? streakPhrase(streak.value, streak.unit) : "none",
  };
}

/** Full settings, in the same shape create_habit / update_habit take. */
export function habitSettingsForAgent(habit: Habit) {
  return {
    name: habit.name,
    description: habit.description,
    icon: resolveHabitIconKey(habit.icon, habit.id),
    color: colorName(habit.colorHex),
    streak_goal: habit.streakGoal,
    goal_type: habit.goalType,
    ...(habit.goalType === "count" ? { times_per_day: habit.completionsPerDay } : {}),
    ...(habit.goalType === "time" ? { minutes: habit.durationMinutes } : {}),
    ...(habit.goalType === "amount" || habit.goalType === "limit"
      ? { amount_target: habit.amountTarget, amount_unit: habit.amountUnit, amount_step: habit.amountStep }
      : {}),
    schedule: describeSchedule(habit.schedule),
    times_of_day: habit.parts,
  };
}

/** The last `n` day keys ending at `wallNow`, newest first. */
export function recentDays(wallNow: Date, n: number): string[] {
  return Array.from({ length: n }, (_, i) => toDateKey(addDays(wallNow, -i)));
}

// --- Finding a habit --------------------------------------------------------

/** Finds a habit by id, exact name, or a unique part of its name (case-insensitive). */
export function findHabit(habits: Habit[], ref: string): Habit {
  const q = ref.trim().toLowerCase();
  const byId = habits.find((h) => h.id === ref.trim());
  if (byId) return byId;
  const exact = habits.filter((h) => h.name.trim().toLowerCase() === q);
  if (exact.length === 1) return exact[0];
  const partial = exact.length ? exact : habits.filter((h) => h.name.toLowerCase().includes(q));
  if (partial.length === 1) return partial[0];
  if (partial.length === 0) {
    throw new HabitInputError(
      `No habit matches "${ref}". Habits: ${habits.map((h) => `"${h.name}"`).join(", ") || "none yet"}.`
    );
  }
  throw new HabitInputError(
    `"${ref}" matches several habits: ${partial.map((h) => `"${h.name}" (id ${h.id})`).join(", ")}. Use the id.`
  );
}
