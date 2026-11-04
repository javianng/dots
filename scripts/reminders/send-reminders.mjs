#!/usr/bin/env node
/**
 * Sends daily habit reminders over Web Push. Run on a schedule by
 * .github/workflows/reminders.yml (every 15 minutes).
 *
 * For each user with `reminder.enabled`, if their local time has reached
 * `reminder.time` today and no reminder has gone out today, it counts habits due and not yet completed today (skipping rest days and
 * met weekly/monthly targets) and pushes to every
 * subscribed device. Users who've already finished everything get no push.
 *
 * Env:
 *   FIREBASE_SERVICE_ACCOUNT  service account JSON (string)
 *   VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT (mailto: or https: URL)
 *   FORCE=true                ignore time window/lastSentDate (for testing)
 *   DRY_RUN=true              log what would be sent, send nothing
 */

import { cert, initializeApp } from "firebase-admin/app";
import { FieldPath, getFirestore } from "firebase-admin/firestore";
import webpush from "web-push";

const FORCE = process.env.FORCE === "true";
const DRY_RUN = process.env.DRY_RUN === "true";

/** Local date key and minutes-since-midnight for `now` in `timeZone`. */
export function localNow(now, timeZone) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value])
  );
  return {
    dateKey: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

export function parseTime(hhmm) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm ?? "");
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return null;
  return h * 60 + m;
}

/** Whether a reminder is due for these settings at `now`. */
export function isDue(reminder, now, force = false) {
  if (!reminder?.enabled) return { due: false };
  const timeZone = isValidTimeZone(reminder.timezone) ? reminder.timezone : "UTC";
  const { dateKey, minutes } = localNow(now, timeZone);
  if (force) return { due: true, dateKey };
  const target = parseTime(reminder.time);
  if (target === null) return { due: false };
  if (reminder.lastSentDate === dateKey) return { due: false };
  // Any time after the reminder time, until local midnight. Scheduled runs
  // can start hours late, and a late reminder beats a missed one.
  return { due: minutes >= target, dateKey };
}

function isValidTimeZone(tz) {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function reminderMessage(remaining, total) {
  if (total === remaining) {
    return remaining === 1
      ? "Your habit is still waiting for today's dot."
      : `None of your ${remaining} habits are done yet today.`;
  }
  return remaining === 1
    ? "One habit left to fill in today."
    : `${remaining} habits left to fill in today.`;
}

/**
 * Whether to record today's reminder as sent. If every push failed, leave it
 * unset so the next run retries. FORCE runs are tests and must not use up the
 * real reminder for the day.
 */
export function shouldMarkSent({ force = false, delivered, failed }) {
  return !force && (delivered > 0 || failed === 0);
}

/** Weekday (0 = Sunday) of a 'YYYY-MM-DD' key, timezone-free. */
function weekdayOf(dateKey) {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** First day ('YYYY-MM-DD') of the week (Monday) or month containing `dateKey`. */
export function periodStartKey(dateKey, period) {
  const [y, m, d] = dateKey.split("-").map(Number);
  if (period === "month") return `${y}-${String(m).padStart(2, "0")}-01`;
  const date = new Date(Date.UTC(y, m - 1, d - ((weekdayOf(dateKey) + 6) % 7)));
  return date.toISOString().slice(0, 10);
}

/**
 * Whether a habit should count towards today's reminder, given its schedule
 * and how many days it's been completed so far this period. Mirrors
 * lib/schedule.ts in the app: rest days and met weekly/monthly quotas don't nag.
 */
export function isHabitDue(schedule, dateKey, doneThisPeriod = 0) {
  if (schedule?.type === "days" && Array.isArray(schedule.days) && schedule.days.length > 0) {
    return schedule.days.includes(weekdayOf(dateKey));
  }
  if (schedule?.type === "period" && (schedule.period === "week" || schedule.period === "month")) {
    return doneThisPeriod < Math.max(1, Number(schedule.times) || 1);
  }
  return true;
}

// A day with only some taps isn't done yet; older docs have no flag.
const isCompleted = (snap) => snap.exists && snap.get("completed") !== false;

async function countRemaining(db, uid, dateKey) {
  const habits = await db.collection(`users/${uid}/habits`).get();
  if (habits.empty) return { total: 0, remaining: 0 };
  const results = await Promise.all(
    habits.docs.map(async (h) => {
      const schedule = h.get("schedule");
      const completions = h.ref.collection("completions");
      const today = await completions.doc(dateKey).get();
      if (isCompleted(today)) return "done";
      let doneThisPeriod = 0;
      if (schedule?.type === "period") {
        const since = await completions
          .where(FieldPath.documentId(), ">=", periodStartKey(dateKey, schedule.period))
          .where(FieldPath.documentId(), "<=", dateKey)
          .get();
        doneThisPeriod = since.docs.filter(isCompleted).length;
      }
      return isHabitDue(schedule, dateKey, doneThisPeriod) ? "due" : "rest";
    })
  );
  return {
    total: results.filter((r) => r !== "rest").length,
    remaining: results.filter((r) => r === "due").length,
  };
}

async function main() {
  const required = [
    "FIREBASE_SERVICE_ACCOUNT",
    "VAPID_PUBLIC_KEY",
    "VAPID_PRIVATE_KEY",
    "VAPID_SUBJECT",
  ];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) {
    throw new Error(`Missing env: ${missing.join(", ")}`);
  }

  initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
  const db = getFirestore();
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );

  const now = new Date();
  const users = await db.collection("users").where("reminder.enabled", "==", true).get();
  console.log(`${users.size} user(s) with reminders on${FORCE ? " (FORCE)" : ""}`);

  let sent = 0;
  let removed = 0;

  for (const user of users.docs) {
    const reminder = user.get("reminder");
    const { due, dateKey } = isDue(reminder, now, FORCE);
    if (!due) continue;

    const { total, remaining } = await countRemaining(db, user.id, dateKey);
    if (remaining === 0 && !FORCE) {
      // All done (or no habits): skip, and don't check again today.
      if (!DRY_RUN) await user.ref.update({ "reminder.lastSentDate": dateKey });
      continue;
    }

    const subs = await user.ref.collection("pushSubscriptions").get();
    const payload = JSON.stringify({
      title: "dots",
      body:
        remaining > 0
          ? reminderMessage(remaining, total)
          : "Test reminder from dots.",
      url: "/",
      tag: `dots-reminder-${dateKey}`,
    });

    let delivered = 0;
    let failed = 0;

    for (const sub of subs.docs) {
      const { endpoint, keys } = sub.data();
      if (DRY_RUN) {
        console.log(`[dry run] ${user.id} → ${new URL(endpoint).host}: ${payload}`);
        continue;
      }
      try {
        await webpush.sendNotification({ endpoint, keys }, payload, { TTL: 60 * 60 * 6 });
        sent++;
        delivered++;
      } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          // Subscription expired or was revoked; clean it up.
          await sub.ref.delete();
          removed++;
        } else {
          failed++;
          console.error(`Push failed for ${user.id}: ${err.statusCode ?? ""} ${err.body ?? err.message}`);
        }
      }
    }

    if (!DRY_RUN && shouldMarkSent({ force: FORCE, delivered, failed })) {
      await user.ref.update({ "reminder.lastSentDate": dateKey });
    }
  }

  console.log(`Sent ${sent} notification(s), removed ${removed} expired subscription(s).`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
