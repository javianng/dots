/** Local-timezone date helpers. All keys are 'YYYY-MM-DD'. */

export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function todayKey(): string {
  return toDateKey(new Date());
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/** The last `n` days as Dates, oldest first, ending today. */
export function lastNDays(n: number): Date[] {
  const today = new Date();
  return Array.from({ length: n }, (_, i) => addDays(today, i - (n - 1)));
}

/**
 * Columns for a GitHub-style heatmap: `weeks` columns of 7 days each
 * (Monday-first), with today in the final column.
 */
export function heatmapWeeks(weeks: number): Date[][] {
  const today = new Date();
  // getDay(): Sunday = 0 → Monday-first offset.
  const mondayOffset = (today.getDay() + 6) % 7;
  const lastMonday = addDays(today, -mondayOffset);
  return Array.from({ length: weeks }, (_, w) => {
    const weekStart = addDays(lastMonday, (w - (weeks - 1)) * 7);
    return Array.from({ length: 7 }, (_, d) => addDays(weekStart, d));
  });
}

/**
 * Consecutive completed days ending today. If today isn't completed yet the
 * run ending yesterday still counts, so a streak isn't "lost" before the
 * day is logged.
 */
export function currentStreak(history: Record<string, boolean>): number {
  const today = new Date();
  let cursor = history[toDateKey(today)] ? today : addDays(today, -1);
  let streak = 0;
  while (history[toDateKey(cursor)]) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

export function isSameDay(a: Date, b: Date): boolean {
  return toDateKey(a) === toDateKey(b);
}

export const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

