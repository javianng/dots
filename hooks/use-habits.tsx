"use client";

import * as React from "react";
import {
  onSnapshot,
  orderBy,
  query,
  type Timestamp,
} from "firebase/firestore";

import { completionsCollection, habitsCollection } from "@/lib/habits";
import type { Habit } from "@/lib/types";

type HabitMeta = Omit<Habit, "history" | "counts">;

// Snapshots are tagged with the uid they were loaded for, so switching users
// discards stale data by derivation instead of resetting state in an effect.
interface MetaSnapshot {
  uid: string;
  metas: HabitMeta[];
}

interface HistorySnapshot {
  uid: string;
  /** Per day: the logged count, or null for docs saved before counts existed. */
  byHabit: Record<string, Record<string, number | null>>;
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
            completionsPerDay: Math.max(1, (data.completionsPerDay as number) ?? 1),
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
        const history: Record<string, number | null> = {};
        for (const d of snap.docs) {
          const count = d.data().count;
          history[d.id] = typeof count === "number" ? count : null;
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
    return metas.map((meta) => {
      const target = meta.completionsPerDay;
      const history: Record<string, boolean> = {};
      const counts: Record<string, number> = {};
      for (const [day, raw] of Object.entries(byHabit[meta.id] ?? {})) {
        // Days saved before counts existed were plain check-offs: treat as done.
        const count = raw ?? target;
        counts[day] = count;
        history[day] = count >= target;
      }
      return { ...meta, history, counts };
    });
  }, [metas, historySnap, uid]);

  return { habits, loading: habits === null };
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
