/**
 * Reads and writes one user's habits with the Firebase Admin SDK, using the
 * same document shapes as the app (lib/habits.ts). Admin access bypasses the
 * Firestore rules, so every path here is scoped to `ctx.uid`.
 */
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore, type Firestore } from "firebase-admin/firestore";

import { buildHabit, type DayDoc, parseDayDoc, parseHabitMeta } from "@/lib/habit-model";
import {
  dateKeyIn,
  type DayWrite,
  isValidTimeZone,
  type LogPlan,
} from "@/lib/server/habit-logic";
import type { Habit, HabitDraft } from "@/lib/types";

const BATCH_LIMIT = 500;
const DEFAULT_TIME_ZONE = "Asia/Singapore";

export interface StoreContext {
  db: Firestore;
  uid: string;
  timeZone: string;
}

// --- Setup ------------------------------------------------------------------

function adminApp(): App {
  const existing = getApps().find((a) => a.name === "dots-mcp");
  if (existing) return existing;
  // FIREBASE_AUTH_EMULATOR_HOST / FIRESTORE_EMULATOR_HOST (tests) need no key.
  if (process.env.FIRESTORE_EMULATOR_HOST) {
    return initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID ?? "demo-dots" }, "dots-mcp");
  }
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT isn't set.");
  return initializeApp({ credential: cert(JSON.parse(raw)) }, "dots-mcp");
}

let cached: Promise<StoreContext> | null = null;

/**
 * The store for the dots account named by DOTS_USER (an email or a uid),
 * in that user's reminder time zone (or DOTS_TIME_ZONE, or Singapore).
 */
export function storeContext(): Promise<StoreContext> {
  cached ??= (async () => {
    const app = adminApp();
    const db = getFirestore(app);
    const who = process.env.DOTS_USER?.trim();
    if (!who) throw new Error("DOTS_USER isn't set.");
    const uid = who.includes("@") ? (await getAuth(app).getUserByEmail(who)).uid : who;
    const user = await db.doc(`users/${uid}`).get();
    const tz = user.get("reminder.timezone") ?? process.env.DOTS_TIME_ZONE;
    return { db, uid, timeZone: isValidTimeZone(tz) ? tz : DEFAULT_TIME_ZONE };
  })().catch((err) => {
    cached = null;
    throw err;
  });
  return cached;
}

// --- Reads ------------------------------------------------------------------

const habitsRef = (ctx: StoreContext) => ctx.db.collection(`users/${ctx.uid}/habits`);
const completionsRef = (ctx: StoreContext, habitId: string) =>
  habitsRef(ctx).doc(habitId).collection("completions");

/** Every habit, oldest first, with its full history (like the app's main screen). */
export async function loadHabits(ctx: StoreContext, now = new Date()): Promise<Habit[]> {
  const snap = await habitsRef(ctx).orderBy("createdAt", "asc").get();
  const toKey = (d: Date) => dateKeyIn(d, ctx.timeZone);
  return Promise.all(
    snap.docs.map(async (doc) => {
      const days: Record<string, DayDoc> = {};
      for (const d of (await completionsRef(ctx, doc.id).get()).docs) days[d.id] = parseDayDoc(d.data());
      return buildHabit(parseHabitMeta(doc.id, doc.data()), days, now, toKey);
    })
  );
}

// --- Writes -----------------------------------------------------------------

export async function createHabit(ctx: StoreContext, draft: HabitDraft): Promise<string> {
  const ref = habitsRef(ctx).doc();
  await ref.set({ ...draft, createdAt: FieldValue.serverTimestamp() });
  return ref.id;
}

export async function updateHabit(ctx: StoreContext, habitId: string, draft: HabitDraft) {
  await habitsRef(ctx).doc(habitId).update({ ...draft });
}

/** Rewrites past days after a goal-type change (lib/habits.ts rescaleCompletions). */
export async function rescaleCompletions(
  ctx: StoreContext,
  habitId: string,
  plan: { days: Record<string, boolean>; target: number; keepDone: boolean },
  clearTimer: boolean
) {
  const keys = Object.keys(plan.days);
  for (let i = 0; i < keys.length; i += BATCH_LIMIT) {
    const batch = ctx.db.batch();
    for (const key of keys.slice(i, i + BATCH_LIMIT)) {
      const ref = completionsRef(ctx, habitId).doc(key);
      if (plan.days[key] && plan.keepDone && plan.target > 0) {
        batch.set(ref, { count: plan.target, completed: true }, { merge: true });
      } else batch.delete(ref);
    }
    await batch.commit();
  }
  if (clearTimer) await habitsRef(ctx).doc(habitId).update({ timer: null });
}

/** Deletes a habit and all its days. */
export async function deleteHabit(ctx: StoreContext, habitId: string) {
  await ctx.db.recursiveDelete(habitsRef(ctx).doc(habitId));
}

function dayData(write: DayWrite) {
  if (write.kind === "skip") {
    return { count: 0, completed: false, skipped: true, completedAt: FieldValue.serverTimestamp() };
  }
  if (write.kind === "set") {
    return {
      count: write.count,
      completed: write.completed,
      ...(write.slots ? { slots: write.slots } : {}),
      completedAt: FieldValue.serverTimestamp(),
    };
  }
  return null;
}

/** Applies a planned log action in one atomic write. */
export async function applyLog(ctx: StoreContext, habitId: string, dateKey: string, plan: LogPlan) {
  const batch = ctx.db.batch();
  const ref = completionsRef(ctx, habitId).doc(dateKey);
  const data = dayData(plan.write);
  if (data) batch.set(ref, data);
  else batch.delete(ref);
  if (plan.stopTimer) batch.update(habitsRef(ctx).doc(habitId), { timer: null });
  await batch.commit();
}
