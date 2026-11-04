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

export function morningMessage(remaining) {
  return remaining === 1
    ? "One morning habit to fill in."
    : `${remaining} morning habits to fill in.`;
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

function addDaysKey(dateKey, days) {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/**
 * Whether a habit should count towards today's reminder. Mirrors
 * lib/schedule.ts in the app: rest days, met weekly/monthly targets,
 * every-N-days habits that aren't due yet, and limits never nag.
 *
 * `doneInWindow` is how many days were done or skipped in the habit's window:
 * this week/month for period schedules, the last N-1 days for intervals.
 */
export function isHabitDue(habit, dateKey, doneInWindow = 0) {
  const schedule = habit?.schedule;
  if (habit?.goalType === "limit") return false;
  if (schedule?.type === "days" && Array.isArray(schedule.days) && schedule.days.length > 0) {
    return schedule.days.includes(weekdayOf(dateKey));
  }
  if (schedule?.type === "period" && (schedule.period === "week" || schedule.period === "month")) {
    return doneInWindow < Math.max(1, Number(schedule.times) || 1);
  }
  if (schedule?.type === "interval") return doneInWindow === 0;
  return true;
}

/** First day of the window `isHabitDue` needs counted, or null if none. */
export function windowStartKey(schedule, dateKey) {
  if (schedule?.type === "period") return periodStartKey(dateKey, schedule.period);
  if (schedule?.type === "interval" && Number(schedule.every) >= 2) {
    return addDaysKey(dateKey, -(Number(schedule.every) - 1));
  }
  return null;
}

// A day with only some taps isn't done yet; older docs have no flag.
// Skipped days count as handled.
const isHandled = (snap) =>
  snap.exists && (snap.get("skipped") === true || snap.get("completed") !== false);

/**
 * Counts today's habits for a reminder. With `part` ("morning"), only
 * habits set for that time of day count, and a habit checked off several
 * times a day counts as done once that part's check is in.
 */
async function countRemaining(db, uid, dateKey, part = null) {
  const habits = await db.collection(`users/${uid}/habits`).get();
  if (habits.empty) return { total: 0, remaining: 0 };
  const results = await Promise.all(
    habits.docs.map(async (h) => {
      const data = h.data();
      const parts = Array.isArray(data.parts) ? data.parts : [];
      if (part && !parts.includes(part)) return "rest";
      const completions = h.ref.collection("completions");
      const today = await completions.doc(dateKey).get();
      if (isHandled(today)) return "done";
      if (part && today.exists && (today.get("slots") ?? []).includes(part)) return "done";
      let doneInWindow = 0;
      const start = windowStartKey(data.schedule, dateKey);
      if (start) {
        const since = await completions
          .where(FieldPath.documentId(), ">=", start)
          .where(FieldPath.documentId(), "<=", dateKey)
          .get();
        doneInWindow = since.docs.filter(isHandled).length;
      }
      return isHabitDue(data, dateKey, doneInWindow) ? "due" : "rest";
    })
  );
  return {
    total: results.filter((r) => r !== "rest").length,
    remaining: results.filter((r) => r === "due").length,
  };
}

/**
 * The optional morning reminder: same rules as the daily one, but only
 * before noon (a morning nudge in the evening is just noise).
 */
export function isMorningDue(reminder, now, force = false) {
  if (!reminder?.enabled || !reminder.morningTime) return { due: false };
  const result = isDue(
    { ...reminder, time: reminder.morningTime, lastSentDate: reminder.lastMorningSentDate },
    now,
    force
  );
  if (!result.due || force) return result;
  const timeZone = isValidTimeZone(reminder.timezone) ? reminder.timezone : "UTC";
  return localNow(now, timeZone).minutes < 12 * 60 ? result : { due: false };
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
    const runs = [
      { kind: "daily", ...isDue(reminder, now, FORCE), field: "reminder.lastSentDate", part: null },
      {
        kind: "morning",
        ...isMorningDue(reminder, now, FORCE),
        field: "reminder.lastMorningSentDate",
        part: "morning",
      },
    ];

    for (const run of runs) {
      if (!run.due) continue;
      const { dateKey } = run;

      const { total, remaining } = await countRemaining(db, user.id, dateKey, run.part);
      if (remaining === 0 && !FORCE) {
        // All done (or nothing due): skip, and don't check again today.
        if (!DRY_RUN) await user.ref.update({ [run.field]: dateKey });
        continue;
      }

      const subs = await user.ref.collection("pushSubscriptions").get();
      const payload = JSON.stringify({
        title: "dots",
        body:
          remaining > 0
            ? run.part
              ? morningMessage(remaining)
              : reminderMessage(remaining, total)
            : "Test reminder from dots.",
        url: "/",
        tag: `dots-${run.kind}-${dateKey}`,
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
            console.error(
              `Push failed for ${user.id}: ${err.statusCode ?? ""} ${err.body ?? err.message}`
            );
          }
        }
      }

      if (!DRY_RUN && shouldMarkSent({ force: FORCE, delivered, failed })) {
        await user.ref.update({ [run.field]: dateKey });
      }
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
