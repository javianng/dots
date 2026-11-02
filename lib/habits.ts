import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import type { HabitDraft } from "@/lib/types";

const BATCH_LIMIT = 500;

export function habitsCollection(uid: string) {
  return collection(db, "users", uid, "habits");
}

export function completionsCollection(uid: string, habitId: string) {
  return collection(db, "users", uid, "habits", habitId, "completions");
}

export async function createHabit(uid: string, draft: HabitDraft): Promise<string> {
  const ref = doc(habitsCollection(uid));
  await setDoc(ref, { ...draft, createdAt: serverTimestamp() });
  return ref.id;
}

export async function updateHabit(uid: string, habitId: string, draft: HabitDraft) {
  await updateDoc(doc(db, "users", uid, "habits", habitId), { ...draft });
}

/**
 * Deletes a habit and its completions (Firestore doesn't cascade to
 * subcollections). The habit doc goes last, so if a chunk fails the habit is
 * still there to retry from rather than leaving invisible orphans.
 */
export async function deleteHabit(uid: string, habitId: string) {
  const completions = await getDocs(completionsCollection(uid, habitId));
  const refs = [
    ...completions.docs.map((d) => d.ref),
    doc(habitsCollection(uid), habitId),
  ];
  for (let i = 0; i < refs.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    refs.slice(i, i + BATCH_LIMIT).forEach((ref) => batch.delete(ref));
    await batch.commit();
  }
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
