"use client";

import * as React from "react";
import {
  onSnapshot,
  orderBy,
  query,
  type Timestamp,
} from "firebase/firestore";

import { completionsCollection, habitsCollection } from "@/lib/habits";
import { addDays, toDateKey } from "@/lib/dates";
import {
  dayTarget,
  isDayMet,
  parseGoalType,
  parseParts,
  parseSchedule,
} from "@/lib/schedule";
import type { DayPart, Habit, RunningTimer } from "@/lib/types";

type HabitMeta = Omit<Habit, "history" | "counts" | "skipped" | "slots">;

/** One completion doc as the app needs it. */
interface DayDoc {
  /** null for docs saved before counts existed (plain check-offs). */
  count: number | null;
  skipped: boolean;
  slots: DayPart[];
}

// Snapshots are tagged with the uid they were loaded for, so switching users
// discards stale data by derivation instead of resetting state in an effect.
interface MetaSnapshot {
  uid: string;
  metas: HabitMeta[];
}

interface HistorySnapshot {
  uid: string;
  byHabit: Record<string, Record<string, DayDoc>>;
}

/**
 * Realtime habits for a user: habit docs plus each habit's completions
 * subcollection merged into a `history` map. Firestore latency compensation
 * makes local toggles show up immediately (optimistic updates for free).
 */
function useHabitsRealtime(uid: string | undefined) {
  const [metaSnap, setMetaSnap] = React.useState<MetaSnapshot | null>(null);
  const [historySnap, setHistorySnap] = React.useState<HistorySnapshot | null>(
    null
  );

  React.useEffect(() => {
    if (!uid) return;
    return onSnapshot(
      query(habitsCollection(uid), orderBy("createdAt", "asc")),
      (snap) => {
        const metas = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
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
            createdAt:
              (data.createdAt as Timestamp | null)?.toMillis() ?? Date.now(),
          };
        });
        setMetaSnap({ uid, metas });
      }
    );
  }, [uid]);

  const metas = metaSnap && metaSnap.uid === uid ? metaSnap.metas : null;

  const habitIds = React.useMemo(
    () => (metas ?? []).map((m) => m.id).join("\n"),
    [metas]
  );

  React.useEffect(() => {
    if (!uid || !habitIds) return;
    const unsubs = habitIds.split("\n").map((habitId) =>
      onSnapshot(completionsCollection(uid, habitId), (snap) => {
        const history: Record<string, DayDoc> = {};
        for (const d of snap.docs) {
          const data = d.data();
          history[d.id] = {
            count: typeof data.count === "number" ? data.count : null,
            skipped: data.skipped === true,
            slots: parseParts(data.slots),
          };
        }
        setHistorySnap((prev) => ({
          uid,
          byHabit: {
            ...(prev?.uid === uid ? prev.byHabit : {}),
            [habitId]: history,
          },
        }));
      })
    );
    return () => unsubs.forEach((unsub) => unsub());
  }, [uid, habitIds]);

  const habits: Habit[] | null = React.useMemo(() => {
    if (!metas) return null;
    const byHabit =
      historySnap && historySnap.uid === uid ? historySnap.byHabit : {};
    const today = toDateKey(new Date());
    return metas.map((meta) => {
      const target = dayTarget(meta);
      const history: Record<string, boolean> = {};
      const counts: Record<string, number> = {};
      const skipped: Record<string, true> = {};
      const slots: Record<string, DayPart[]> = {};
      if (meta.goalType === "limit") {
        // A limit is kept on every day nothing was logged, from the day the
        // habit was made; logged days are checked against the limit below.
        for (let d = new Date(meta.createdAt); toDateKey(d) <= today; d = addDays(d, 1)) {
          history[toDateKey(d)] = true;
        }
      }
      for (const [day, doc] of Object.entries(byHabit[meta.id] ?? {})) {
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
    });
  }, [metas, historySnap, uid]);

  return { habits, loading: habits === null };
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

const HabitsContext = React.createContext<{
  habits: Habit[] | null;
  loading: boolean;
}>({ habits: null, loading: true });

/**
 * Keeps one realtime subscription for the signed-in user at the app root, so
 * moving between screens shows data instantly (no skeleton flash), which is
 * what lets page transitions feel native.
 */
export function HabitsProvider({
  uid,
  children,
}: {
  uid: string | undefined;
  children: React.ReactNode;
}) {
  const value = useHabitsRealtime(uid);
  return (
    <HabitsContext.Provider value={value}>{children}</HabitsContext.Provider>
  );
}

export function useHabits() {
  return React.useContext(HabitsContext);
}
