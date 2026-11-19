"use client";

import * as React from "react";
import { onSnapshot, orderBy, query } from "firebase/firestore";

import { completionsCollection, habitsCollection } from "@/lib/habits";
import {
  buildHabit,
  type DayDoc,
  type HabitMeta,
  parseDayDoc,
  parseHabitMeta,
} from "@/lib/habit-model";
import type { Habit } from "@/lib/types";

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
        const metas = snap.docs.map((d) => parseHabitMeta(d.id, d.data()));
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
          history[d.id] = parseDayDoc(d.data());
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
    const now = new Date();
    return metas.map((meta) => buildHabit(meta, byHabit[meta.id] ?? {}, now));
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
