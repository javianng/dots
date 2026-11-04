/**
 * Schedules (daily / fixed weekdays / N times a week or month) and the
 * goal-aware helpers built on them: daily target, today's status, streaks.
 */
import { addDays, toDateKey, todayKey } from "@/lib/dates";
import type { GoalType, Habit, Schedule } from "@/lib/types";

export const DAILY: Schedule = { type: "daily" };

/** Monday-first, for pickers. Values are JS getDay() numbers. */
export const WEEKDAYS = [
  { value: 1, short: "M", long: "Mon" },
  { value: 2, short: "T", long: "Tue" },
  { value: 3, short: "W", long: "Wed" },
  { value: 4, short: "T", long: "Thu" },
  { value: 5, short: "F", long: "Fri" },
  { value: 6, short: "S", long: "Sat" },
  { value: 0, short: "S", long: "Sun" },
];

export const MAX_TIMES = { week: 6, month: 27 } as const;

/** Reads a stored schedule defensively: anything malformed falls back to daily. */
export function parseSchedule(raw: unknown): Schedule {
  if (!raw || typeof raw !== "object") return DAILY;
  const s = raw as Record<string, unknown>;
  if (s.type === "days" && Array.isArray(s.days)) {
    const days = [...new Set(s.days.filter((d): d is number => Number.isInteger(d) && d >= 0 && d <= 6))];
    return days.length === 0 || days.length === 7 ? DAILY : { type: "days", days: days.sort() };
  }
  if (s.type === "period" && (s.period === "week" || s.period === "month")) {
    const times = Math.round(Number(s.times));
    if (Number.isFinite(times) && times >= 1) {
      return { type: "period", period: s.period, times: Math.min(times, MAX_TIMES[s.period]) };
    }
  }
  return DAILY;
}

export function parseGoalType(raw: unknown): GoalType {
  return raw === "time" ? "time" : "count";
}

/** What finishes a day: taps for count goals, seconds for time goals. */
export function dayTarget(habit: Pick<Habit, "goalType" | "completionsPerDay" | "durationMinutes">) {
  return habit.goalType === "time" ? habit.durationMinutes * 60 : habit.completionsPerDay;
}

export function isScheduledDay(schedule: Schedule, date: Date): boolean {
  return schedule.type !== "days" || schedule.days.includes(date.getDay());
}

/** First day of the week (Monday) or month containing `date`. */
export function periodStart(date: Date, period: "week" | "month"): Date {
  if (period === "month") return new Date(date.getFullYear(), date.getMonth(), 1);
  return addDays(new Date(date.getFullYear(), date.getMonth(), date.getDate()), -((date.getDay() + 6) % 7));
}

function nextPeriodStart(start: Date, period: "week" | "month"): Date {
  return period === "month"
    ? new Date(start.getFullYear(), start.getMonth() + 1, 1)
    : addDays(start, 7);
}

/** Completed days inside the period that contains `date` (up to and including `until`). */
export function periodDoneCount(
  history: Record<string, boolean>,
  date: Date,
  period: "week" | "month",
  until: Date = date
): number {
  let done = 0;
  const end = toDateKey(until);
  for (let d = periodStart(date, period); toDateKey(d) <= end; d = addDays(d, 1)) {
    if (nextPeriodStart(periodStart(date, period), period) <= d) break;
    if (history[toDateKey(d)]) done += 1;
  }
  return done;
}

export type DayStatus = "done" | "due" | "rest";

/**
 * Today, for this habit:
 * - done: logged today, or a weekly/monthly quota already met.
 * - rest: a fixed-weekday habit that isn't scheduled today.
 * - due: everything else.
 */
export function todayStatus(habit: Habit, now = new Date()): DayStatus {
  if (habit.history[toDateKey(now)]) return "done";
  const { schedule } = habit;
  if (schedule.type === "days") return isScheduledDay(schedule, now) ? "due" : "rest";
  if (schedule.type === "period") {
    return periodDoneCount(habit.history, now, schedule.period) >= schedule.times ? "done" : "due";
  }
  return "due";
}

export type StreakUnit = "day" | "week" | "month";

export function streakUnit(schedule: Schedule): StreakUnit {
  return schedule.type === "period" ? schedule.period : "day";
}

/** "3 days", "1 week". */
export function plural(n: number, unit: string) {
  return `${n} ${unit}${n === 1 ? "" : "s"}`;
}

/** Earliest logged day, so streak walks know when to stop. */
function earliestKey(history: Record<string, boolean>): string | null {
  let min: string | null = null;
  for (const [key, done] of Object.entries(history)) if (done && (!min || key < min)) min = key;
  return min;
}

/**
 * The current streak in the schedule's own unit.
 * - daily: consecutive completed days.
 * - days: consecutive completed *scheduled* days; rest days neither count nor break it.
 * - period: consecutive weeks/months that met the quota.
 * Today (or this week/month) only counts once done, and never breaks the run
 * before it's over.
 */
export function habitStreak(
  habit: Pick<Habit, "history" | "schedule">,
  now = new Date()
): { value: number; unit: StreakUnit } {
  const { history, schedule } = habit;
  const unit = streakUnit(schedule);
  const first = earliestKey(history);
  if (!first) return { value: 0, unit };

  if (schedule.type === "period") {
    const { period, times } = schedule;
    let start = periodStart(now, period);
    let value = 0;
    if (periodDoneCount(history, start, period, now) >= times) value = 1;
    for (;;) {
      start = periodStart(addDays(start, -1), period);
      if (toDateKey(nextPeriodStart(start, period)) <= first) break;
      const end = addDays(nextPeriodStart(start, period), -1);
      if (periodDoneCount(history, start, period, end) < times) break;
      value += 1;
    }
    return { value, unit };
  }

  let cursor = now;
  let value = 0;
  // Today can't break a streak before it's logged.
  if (!history[toDateKey(cursor)]) cursor = addDays(cursor, -1);
  while (toDateKey(cursor) >= first) {
    const key = toDateKey(cursor);
    if (history[key]) {
      if (isScheduledDay(schedule, cursor)) value += 1;
    } else if (isScheduledDay(schedule, cursor)) {
      break;
    }
    cursor = addDays(cursor, -1);
  }
  return { value, unit };
}

/** Short human description: "Every day", "Mon, Wed, Fri", "3× a week". */
export function scheduleLabel(schedule: Schedule): string {
  if (schedule.type === "daily") return "Every day";
  if (schedule.type === "period") return `${schedule.times}× a ${schedule.period}`;
  const set = new Set(schedule.days);
  if (set.size === 5 && [1, 2, 3, 4, 5].every((d) => set.has(d))) return "Weekdays";
  if (set.size === 2 && set.has(0) && set.has(6)) return "Weekends";
  return WEEKDAYS.filter((d) => set.has(d.value)).map((d) => d.long).join(", ");
}

/** Status line under a habit name. */
export function progressLabel(habit: Habit, now = new Date()): string {
  const { value, unit } = habitStreak(habit, now);
  const { schedule } = habit;
  if (schedule.type === "period") {
    const done = periodDoneCount(habit.history, now, schedule.period);
    const thisPeriod = `${Math.min(done, schedule.times)}/${schedule.times} this ${schedule.period}`;
    return value > 0 ? `${thisPeriod} · ${value}-${unit} streak` : thisPeriod;
  }
  if (todayStatus(habit, now) === "rest" && !habit.history[todayKey()]) {
    return value > 0 ? `Rest day · ${value}-${unit} streak` : "Rest day";
  }
  if (value > 0) return `${value}-${unit} streak`;
  return Object.values(habit.history).some(Boolean) ? "No current streak" : "Not started";
}
