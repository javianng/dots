/**
 * Turns raw Firestore data into `Habit` objects. Shared by the app
 * (hooks/use-habits.tsx, client SDK) and the MCP server (lib/server, Admin
 * SDK), so both read habits by exactly the same rules.
 */
import { addDays, toDateKey } from "@/lib/dates";
import { dayTarget, isDayMet, parseGoalType, parseParts, parseSchedule } from "@/lib/schedule";
import type { DayPart, Habit, RunningTimer } from "@/lib/types";

export type HabitMeta = Omit<Habit, "history" | "counts" | "skipped" | "slots">;

/** One completion doc as the app needs it. */
export interface DayDoc {
  /** null for docs saved before counts existed (plain check-offs). */
  count: number | null;
  skipped: boolean;
  slots: DayPart[];
}

/** Anything with toMillis(): client and Admin SDK Timestamps both qualify. */
interface TimestampLike {
  toMillis(): number;
}

function num(raw: unknown, fallback: number) {
  return typeof raw === "number" && Number.isFinite(raw) ? raw : fallback;
}

function parseTimer(raw: unknown): RunningTimer | null {
  if (!raw || typeof raw !== "object") return null;
  const { startedAt, dateKey } = raw as Record<string, unknown>;
  return typeof startedAt === "number" && typeof dateKey === "string"
    ? { startedAt, dateKey }
    : null;
}

/** A habit doc's fields, with defaults for anything missing or malformed. */
export function parseHabitMeta(id: string, data: Record<string, unknown>): HabitMeta {
  return {
    id,
    name: (data.name as string) ?? "",
    description: (data.description as string) ?? "",
    icon: data.icon as string | undefined,
    colorHex: (data.colorHex as string) ?? "#8b5cf6",
    streakGoal: (data.streakGoal as number | null) ?? null,
    goalType: parseGoalType(data.goalType),
    completionsPerDay: Math.max(1, (data.completionsPerDay as number) ?? 1),
    durationMinutes: Math.max(1, (data.durationMinutes as number) ?? 15),
    amountTarget: Math.max(0, num(data.amountTarget, 1)),
    amountUnit: typeof data.amountUnit === "string" ? data.amountUnit : "",
    amountStep: Math.max(0.01, num(data.amountStep, 1)),
    parts: parseParts(data.parts),
    schedule: parseSchedule(data.schedule),
    timer: parseTimer(data.timer),
    createdAt: (data.createdAt as TimestampLike | null)?.toMillis() ?? Date.now(),
  };
}

/** A completion doc's fields. */
export function parseDayDoc(data: Record<string, unknown>): DayDoc {
  return {
    count: typeof data.count === "number" ? data.count : null,
    skipped: data.skipped === true,
    slots: parseParts(data.slots),
  };
}

/**
 * Merges a habit's completion docs into `history`, `counts`, `skipped` and
 * `slots`. `toKey` turns an instant into a day key; the app uses the device's
 * local time, the MCP server the user's time zone.
 */
export function buildHabit(
  meta: HabitMeta,
  days: Record<string, DayDoc>,
  now: Date = new Date(),
  toKey: (date: Date) => string = toDateKey
): Habit {
  const today = toKey(now);
  const target = dayTarget(meta);
  const history: Record<string, boolean> = {};
  const counts: Record<string, number> = {};
  const skipped: Record<string, true> = {};
  const slots: Record<string, DayPart[]> = {};
  if (meta.goalType === "limit") {
    // A limit is kept on every day nothing was logged, from the day the
    // habit was made; logged days are checked against the limit below.
    for (let d = new Date(meta.createdAt); toKey(d) <= today; d = addDays(d, 1)) {
      history[toKey(d)] = true;
    }
  }
  for (const [day, doc] of Object.entries(days)) {
    if (doc.skipped) {
      skipped[day] = true;
      delete history[day];
      continue;
    }
    // Days saved before counts existed were plain check-offs: treat as done.
    const count = doc.count ?? target;
    counts[day] = count;
    history[day] = isDayMet(meta, count);
    if (doc.slots.length) slots[day] = doc.slots;
  }
  return { ...meta, history, counts, skipped, slots };
}
