import {
  collection,
  deleteDoc,
  doc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import type { HabitDraft } from "@/lib/types";

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

export async function setCompletion(
  uid: string,
  habitId: string,
  dateKey: string,
  completed: boolean
) {
  const ref = doc(completionsCollection(uid, habitId), dateKey);
  if (completed) {
    await setDoc(ref, { completed: true, completedAt: serverTimestamp() });
  } else {
    await deleteDoc(ref);
  }
}
