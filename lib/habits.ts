import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  getDocsFromCache,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import type { HabitDraft, RunningTimer } from "@/lib/types";

const BATCH_LIMIT = 500;

export function habitsCollection(uid: string) {
  return collection(db, "users", uid, "habits");
}

export function completionsCollection(uid: string, habitId: string) {
  return collection(db, "users", uid, "habits", habitId, "completions");
}

export async function createHabit(uid: string, draft: HabitDraft): Promise<void> {
  await setDoc(doc(habitsCollection(uid)), { ...draft, createdAt: serverTimestamp() });
}

export async function updateHabit(uid: string, habitId: string, draft: HabitDraft) {
  await updateDoc(doc(db, "users", uid, "habits", habitId), { ...draft });
}

/** Stops any running countdown without logging it (e.g. after a goal-type change). */
export async function clearTimer(uid: string, habitId: string) {
  await updateDoc(doc(db, "users", uid, "habits", habitId), { timer: null });
}

/**
 * Deletes a habit and its completions (Firestore doesn't cascade to
 * subcollections). The habit doc goes last, so if a chunk fails the habit is
 * still there to retry from rather than leaving invisible orphans.
 *
 * Completions come from the local cache (the app already listens to them),
 * so this works offline. Batches are committed without waiting on each
 * other: Firestore applies them locally in order and syncs them later.
 */
export async function deleteHabit(uid: string, habitId: string) {
  const completionsRef = completionsCollection(uid, habitId);
  const completions = await getDocsFromCache(completionsRef).catch(() =>
    getDocs(completionsRef)
  );
  const refs = [
    ...completions.docs.map((d) => d.ref),
    doc(habitsCollection(uid), habitId),
  ];
  const commits: Promise<void>[] = [];
  for (let i = 0; i < refs.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    refs.slice(i, i + BATCH_LIMIT).forEach((ref) => batch.delete(ref));
    commits.push(batch.commit());
  }
  await Promise.all(commits);
}

/**
 * Records how many times a habit was done on a day. Zero removes the day.
 * `completed` is stored alongside so readers (e.g. the reminders sender)
 * don't need the habit's target to know whether the day is finished.
 */
export async function setDayCount(
  uid: string,
  habitId: string,
  dateKey: string,
  count: number,
  target: number
) {
  const ref = doc(completionsCollection(uid, habitId), dateKey);
  if (count <= 0) {
    await deleteDoc(ref);
  } else {
    await setDoc(ref, { count, completed: count >= target, completedAt: serverTimestamp() });
  }
}

/** Starts (or resumes) a habit's countdown. */
export async function startTimer(uid: string, habitId: string, timer: RunningTimer) {
  await updateDoc(doc(habitsCollection(uid), habitId), { timer });
}

/**
 * Stops a habit's countdown and logs `seconds` for its day in one atomic
 * write, so the timer and the logged time never disagree (on any device).
 */
export async function stopTimer(
  uid: string,
  habitId: string,
  dateKey: string,
  seconds: number,
  target: number
) {
  const batch = writeBatch(db);
  batch.update(doc(habitsCollection(uid), habitId), { timer: null });
  const ref = doc(completionsCollection(uid, habitId), dateKey);
  if (seconds <= 0) batch.delete(ref);
  else
    batch.set(ref, {
      count: seconds,
      completed: seconds >= target,
      completedAt: serverTimestamp(),
    });
  await batch.commit();
}

/**
 * Switching a habit between check-ins and a timer changes what a day's
 * `count` means (taps vs seconds). Rewrites past days so finished days stay
 * finished at the new target and part-done days are cleared.
 */
export async function rescaleCompletions(
  uid: string,
  habitId: string,
  history: Record<string, boolean>,
  target: number
) {
  const keys = Object.keys(history);
  const commits: Promise<void>[] = [];
  for (let i = 0; i < keys.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    for (const key of keys.slice(i, i + BATCH_LIMIT)) {
      const ref = doc(completionsCollection(uid, habitId), key);
      if (history[key]) batch.set(ref, { count: target, completed: true }, { merge: true });
      else batch.delete(ref);
    }
    commits.push(batch.commit());
  }
  await Promise.all(commits);
}
