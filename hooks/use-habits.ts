"use client";

import * as React from "react";
import {
  onSnapshot,
  orderBy,
  query,
  type Timestamp,
} from "firebase/firestore";

import { completionsCollection, habitsCollection } from "@/lib/habits";
import type { Habit, TrackingType } from "@/lib/types";

type HabitMeta = Omit<Habit, "history">;

// Snapshots are tagged with the uid they were loaded for, so switching users
// discards stale data by derivation instead of resetting state in an effect.
interface MetaSnapshot {
  uid: string;
  metas: HabitMeta[];
}

interface HistorySnapshot {
  uid: string;
  byHabit: Record<string, Record<string, boolean>>;
}

/**
 * Realtime habits for a user: habit docs plus each habit's completions
 * subcollection merged into a `history` map. Firestore latency compensation
 * makes local toggles show up immediately (optimistic updates for free).
 */
export function useHabits(uid: string | undefined) {
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
            completionsPerDay: (data.completionsPerDay as number) ?? 1,
            trackingType: (data.trackingType as TrackingType) ?? "step",
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
        const history: Record<string, boolean> = {};
        for (const d of snap.docs) history[d.id] = true;
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
    return metas.map((meta) => ({ ...meta, history: byHabit[meta.id] ?? {} }));
  }, [metas, historySnap, uid]);

  return { habits, loading: habits === null };
}
