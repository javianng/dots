/**
 * Schedules (daily / fixed weekdays / N times a week or month / every N
 * days), times of day, and the goal-aware helpers built on them: daily
 * target, today's status, streaks and the short labels shown in the UI.
 */
import { addDays, toDateKey } from "@/lib/dates";
import type { DayPart, GoalType, Habit, HabitSettings, Schedule } from "@/lib/types";

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
export const MAX_INTERVAL = 60;

export const DAY_PARTS: { value: DayPart; label: string; until: number }[] = [
  { value: "morning", label: "Morning", until: 12 },
  { value: "afternoon", label: "Afternoon", until: 17 },
  { value: "evening", label: "Evening", until: 24 },
];

/** Which part of the day `now` falls in (morning < 12:00 ≤ afternoon < 17:00 ≤ evening). */
export function currentPart(now = new Date()): DayPart {
  const h = now.getHours();
  return DAY_PARTS.find((p) => h < p.until)!.value;
}

export function partLabel(part: DayPart) {
  return DAY_PARTS.find((p) => p.value === part)!.label;
}

/** Reads a stored schedule defensively: anything malformed falls back to daily. */
export function parseSchedule(raw: unknown): Schedule {
  if (!raw || typeof raw !== "object") return DAILY;
  const s = raw as Record<string, unknown>;
  if (s.type === "days" && Array.isArray(s.days)) {
    const days = [
      ...new Set(s.days.filter((d): d is number => Number.isInteger(d) && d >= 0 && d <= 6)),
    ];
    return days.length === 0 || days.length === 7 ? DAILY : { type: "days", days: days.sort() };
  }
  if (s.type === "period" && (s.period === "week" || s.period === "month")) {
    const times = Math.round(Number(s.times));
    if (Number.isFinite(times) && times >= 1) {
      return { type: "period", period: s.period, times: Math.min(times, MAX_TIMES[s.period]) };
    }
  }
  if (s.type === "interval") {
    const every = Math.round(Number(s.every));
    if (Number.isFinite(every) && every >= 2) {
      return { type: "interval", every: Math.min(every, MAX_INTERVAL) };
    }
  }
  return DAILY;
}

export function parseGoalType(raw: unknown): GoalType {
  return raw === "time" || raw === "amount" || raw === "limit" ? raw : "count";
}

export function parseParts(raw: unknown): DayPart[] {
  if (!Array.isArray(raw)) return [];
  return DAY_PARTS.map((p) => p.value).filter((p) => raw.includes(p));
}

type GoalFields = Pick<
  HabitSettings,
  "goalType" | "completionsPerDay" | "durationMinutes" | "amountTarget"
>;

/**
 * The day's number: taps (count), seconds (time), units (amount). For limit
 * goals it's the maximum allowed.
 */
export function dayTarget(habit: GoalFields) {
  switch (habit.goalType) {
    case "time":
      return habit.durationMinutes * 60;
    case "amount":
    case "limit":
      return habit.amountTarget;
    default:
      return habit.completionsPerDay;
  }
}

/** Whether `count` meets the day's goal (limit goals: stays at or under the limit). */
export function isDayMet(habit: GoalFields, count: number) {
  const target = dayTarget(habit);
  return habit.goalType === "limit" ? count <= target : count >= target;
}

/** Fixed-weekday schedules only happen on their days; everything else can happen any day. */
export function isScheduledDay(schedule: Schedule, date: Date): boolean {
  return schedule.type !== "days" || schedule.days.includes(date.getDay());
}

/** First day of the week (Monday) or month containing `date`. */
export function periodStart(date: Date, period: "week" | "month"): Date {
  if (period === "month") return new Date(date.getFullYear(), date.getMonth(), 1);
  return addDays(
    new Date(date.getFullYear(), date.getMonth(), date.getDate()),
    -((date.getDay() + 6) % 7)
  );
}

function nextPeriodStart(start: Date, period: "week" | "month"): Date {
  return period === "month"
    ? new Date(start.getFullYear(), start.getMonth() + 1, 1)
    : addDays(start, 7);
}

type HistoryFields = Pick<Habit, "history" | "skipped">;

/**
 * Days that count towards the quota in the period containing `date`, up to
 * and including `until`. Skipped days are excused, so they count too.
 */
export function periodDoneCount(
  habit: HistoryFields,
  date: Date,
  period: "week" | "month",
  until: Date = date
): number {
  const start = periodStart(date, period);
  const endKey = toDateKey(until);
  const stopKey = toDateKey(nextPeriodStart(start, period));
  let done = 0;
  for (let d = start; ; d = addDays(d, 1)) {
    const key = toDateKey(d);
    if (key > endKey || key >= stopKey) break;
    if (habit.history[key] || habit.skipped[key]) done += 1;
  }
  return done;
}

function daysBetween(fromKey: string, to: Date): number {
  const [y, m, d] = fromKey.split("-").map(Number);
  const from = new Date(y, m - 1, d);
  const end = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((end.getTime() - from.getTime()) / 86_400_000);
}

/** Done or skipped days up to `now`, newest first (interval anchors). */
function anchorsDesc(habit: HistoryFields, now: Date): string[] {
  const today = toDateKey(now);
  const keys = new Set<string>();
  for (const [k, v] of Object.entries(habit.history)) if (v && k <= today) keys.add(k);
  for (const k of Object.keys(habit.skipped)) if (k <= today) keys.add(k);
  return [...keys].sort().reverse();
}

/** Days until an every-N-days habit is due (0 = due today or overdue). */
export function daysUntilDue(habit: Pick<Habit, "history" | "skipped" | "schedule">, now = new Date()) {
  if (habit.schedule.type !== "interval") return 0;
  const last = anchorsDesc(habit, now)[0];
  if (!last) return 0;
  return Math.max(0, habit.schedule.every - daysBetween(last, now));
}

export type DayStatus = "done" | "due" | "rest" | "skipped";

/**
 * Today, for this habit:
 * - done: logged today, a weekly/monthly quota already met, or (limit goals)
 *   still under the limit.
 * - skipped: marked as skipped for today.
 * - rest: not scheduled today (fixed weekdays, or every-N-days not yet due).
 * - due: everything else.
 */
export function todayStatus(habit: Habit, now = new Date()): DayStatus {
  const today = toDateKey(now);
  if (habit.skipped[today]) return "skipped";
  if (habit.history[today]) return "done";
  const { schedule } = habit;
  if (schedule.type === "days") return isScheduledDay(schedule, now) ? "due" : "rest";
  if (schedule.type === "period") {
    return periodDoneCount(habit, now, schedule.period) >= schedule.times ? "done" : "due";
  }
  if (schedule.type === "interval") return daysUntilDue(habit, now) > 0 ? "rest" : "due";
  return "due";
}

export type StreakUnit = "day" | "week" | "month" | "time";

export function streakUnit(schedule: Schedule): StreakUnit {
  if (schedule.type === "period") return schedule.period;
  if (schedule.type === "interval") return "time";
  return "day";
}

/** "3 days", "1 week". */
export function plural(n: number, unit: string) {
  return `${n} ${unit}${n === 1 ? "" : "s"}`;
}

/** "3-day streak", "4 in a row". */
export function streakPhrase(value: number, unit: StreakUnit) {
  return unit === "time" ? `${value} in a row` : `${value}-${unit} streak`;
}

/** Earliest logged day, so streak walks know when to stop. */
function earliestKey(habit: HistoryFields): string | null {
  let min: string | null = null;
  for (const [key, done] of Object.entries(habit.history)) {
    if (done && (!min || key < min)) min = key;
  }
  return min;
}

/**
 * The current streak in the schedule's own unit.
 * - daily: consecutive completed days.
 * - days: consecutive completed *scheduled* days; rest days neither count nor break it.
 * - period: consecutive weeks/months that met the quota.
 * - interval: completions in a row, each within N days of the one before.
 * Skipped days are treated like rest days everywhere. Today (or this
 * week/month) only counts once done, and never breaks the run before it's over.
 */
export function habitStreak(
  habit: Pick<Habit, "history" | "skipped" | "schedule">,
  now = new Date()
): { value: number; unit: StreakUnit } {
  const { history, skipped, schedule } = habit;
  const unit = streakUnit(schedule);
  const first = earliestKey(habit);
  if (!first) return { value: 0, unit };

  if (schedule.type === "period") {
    const { period, times } = schedule;
    let start = periodStart(now, period);
    let value = 0;
    if (periodDoneCount(habit, start, period, now) >= times) value = 1;
    for (;;) {
      start = periodStart(addDays(start, -1), period);
      if (toDateKey(nextPeriodStart(start, period)) <= first) break;
      const end = addDays(nextPeriodStart(start, period), -1);
      if (periodDoneCount(habit, start, period, end) < times) break;
      value += 1;
    }
    return { value, unit };
  }

  if (schedule.type === "interval") {
    const anchors = anchorsDesc(habit, now);
    if (daysBetween(anchors[0], now) > schedule.every) return { value: 0, unit };
    let value = 0;
    for (let i = 0; i < anchors.length; i++) {
      if (history[anchors[i]]) value += 1;
      const next = anchors[i + 1];
      if (!next || daysBetween(next, parseKey(anchors[i])) > schedule.every) break;
    }
    return { value, unit };
  }

  let cursor = now;
  let value = 0;
  // Today can't break a streak before it's logged.
  if (!history[toDateKey(cursor)]) cursor = addDays(cursor, -1);
  while (toDateKey(cursor) >= first) {
    const key = toDateKey(cursor);
    const scheduled = isScheduledDay(schedule, cursor) && !skipped[key];
    if (history[key]) {
      if (scheduled) value += 1;
    } else if (scheduled) {
      break;
    }
    cursor = addDays(cursor, -1);
  }
  return { value, unit };
}

export function parseKey(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Short human description: "Every day", "Mon, Wed, Fri", "3× a week", "Every 3 days". */
export function scheduleLabel(schedule: Schedule): string {
  if (schedule.type === "daily") return "Every day";
  if (schedule.type === "period") return `${schedule.times}× a ${schedule.period}`;
  if (schedule.type === "interval") return `Every ${schedule.every} days`;
  const set = new Set(schedule.days);
  if (set.size === 5 && [1, 2, 3, 4, 5].every((d) => set.has(d))) return "Weekdays";
  if (set.size === 2 && set.has(0) && set.has(6)) return "Weekends";
  return WEEKDAYS.filter((d) => set.has(d.value))
    .map((d) => d.long)
    .join(", ");
}

/** "1,500", "2.5". */
export function formatAmount(n: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

/** "250 ml", "3 pages", "2". */
export function withUnit(n: number, unit: string) {
  return unit ? `${formatAmount(n)} ${unit}` : formatAmount(n);
}

/** "Morning & evening", "Evening". */
export function partsLabel(parts: DayPart[]) {
  const labels = parts.map(partLabel);
  if (labels.length === 0) return "Any time";
  const text = labels.length === 1 ? labels[0] : `${labels.slice(0, -1).join(", ")} & ${labels.at(-1)!.toLowerCase()}`;
  return text.charAt(0) + text.slice(1).toLowerCase();
}

/** What a day asks for: "Check off", "3× a day", "2,000 ml", "25 min", "At most 2 coffees". */
export function goalLabel(habit: Omit<HabitSettings, "icon">) {
  switch (habit.goalType) {
    case "time": {
      const h = Math.floor(habit.durationMinutes / 60);
      const m = habit.durationMinutes % 60;
      return h === 0 ? `${m} min` : m === 0 ? `${h} h` : `${h} h ${m} min`;
    }
    case "amount":
      return withUnit(habit.amountTarget, habit.amountUnit);
    case "limit":
      return habit.amountTarget === 0
        ? habit.amountUnit
          ? `No ${habit.amountUnit}`
          : "None"
        : `At most ${withUnit(habit.amountTarget, habit.amountUnit)}`;
    default:
      if (habit.parts.length > 1) return "Once each time";
      return habit.completionsPerDay > 1 ? `${habit.completionsPerDay}× a day` : "Check off";
  }
}

/** Status line under a habit name. */
export function progressLabel(habit: Habit, now = new Date()): string {
  const today = toDateKey(now);
  const { value, unit } = habitStreak(habit, now);
  const streak = value > 0 ? streakPhrase(value, unit) : null;
  const join = (...parts: (string | null)[]) => parts.filter(Boolean).join(" · ");
  const { schedule } = habit;
  const status = todayStatus(habit, now);

  if (status === "skipped") return join("Skipped today", streak);
  if (habit.goalType === "limit") {
    const logged = habit.counts[today] ?? 0;
    const left = habit.amountTarget - logged;
    const today_ =
      left < 0
        ? "Over today"
        : left === 0
          ? "At your limit"
          : `${withUnit(left, habit.amountUnit)} left today`;
    return join(today_, streak);
  }
  if (schedule.type === "period") {
    const done = periodDoneCount(habit, now, schedule.period);
    return join(`${Math.min(done, schedule.times)}/${schedule.times} this ${schedule.period}`, streak);
  }
  if (schedule.type === "interval" && status === "rest") {
    const days = daysUntilDue(habit, now);
    return join(days === 1 ? "Due tomorrow" : `Next in ${days} days`, streak);
  }
  if (status === "rest") return join("Rest day", streak);
  if (streak) return streak;
  return Object.values(habit.history).some(Boolean) ? "No current streak" : "Not started";
}
