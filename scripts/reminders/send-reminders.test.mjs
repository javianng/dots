import assert from "node:assert/strict";
import { test } from "node:test";

import {
  isDue,
  isHabitDue,
  isMorningDue,
  periodStartKey,
  windowStartKey,
  localNow,
  parseTime,
  reminderMessage,
  shouldMarkSent,
} from "./send-reminders.mjs";

// 2026-11-01 12:10 UTC = 20:10 in Singapore.
const now = new Date("2026-11-01T12:10:00Z");
const base = { enabled: true, time: "20:00", timezone: "Asia/Singapore" };

test("localNow converts to the user's time zone", () => {
  assert.deepEqual(localNow(now, "Asia/Singapore"), { dateKey: "2026-11-01", minutes: 20 * 60 + 10 });
  assert.equal(localNow(now, "America/Los_Angeles").dateKey, "2026-11-01");
  assert.equal(localNow(new Date("2026-11-01T17:00:00Z"), "Asia/Singapore").dateKey, "2026-11-02");
});

test("parseTime", () => {
  assert.equal(parseTime("08:30"), 510);
  assert.equal(parseTime("24:00"), null);
  assert.equal(parseTime("nope"), null);
});

test("isDue respects time, window, lastSentDate and enabled", () => {
  assert.equal(isDue(base, now).due, true);
  assert.equal(isDue({ ...base, time: "20:15" }, now).due, false); // not yet
  assert.equal(isDue({ ...base, time: "17:00" }, now).due, true); // late runs still send
  // 23:55 in Singapore, reminder at 08:00: still due before midnight.
  assert.equal(isDue({ ...base, time: "08:00" }, new Date("2026-11-01T15:55:00Z")).due, true);
  // Just past midnight: a new day, not due until 20:00 again.
  assert.equal(isDue({ ...base, lastSentDate: "2026-11-01" }, new Date("2026-11-01T16:05:00Z")).due, false);
  assert.equal(isDue({ ...base, lastSentDate: "2026-11-01" }, now).due, false);
  assert.equal(isDue({ ...base, lastSentDate: "2026-10-31" }, now).due, true);
  assert.equal(isDue({ ...base, enabled: false }, now).due, false);
  assert.equal(isDue({ ...base, timezone: "Not/AZone", time: "12:00" }, now).due, true); // falls back to UTC
  assert.equal(isDue({ ...base, time: "23:00", lastSentDate: "2026-11-01" }, now, true).due, true);
});

test("shouldMarkSent retries total failures and ignores forced runs", () => {
  assert.equal(shouldMarkSent({ delivered: 1, failed: 0 }), true);
  assert.equal(shouldMarkSent({ delivered: 1, failed: 1 }), true); // don't re-notify the device that got it
  assert.equal(shouldMarkSent({ delivered: 0, failed: 0 }), true); // no live subscriptions
  assert.equal(shouldMarkSent({ delivered: 0, failed: 2 }), false);
  assert.equal(shouldMarkSent({ force: true, delivered: 1, failed: 0 }), false);
});

test("reminderMessage", () => {
  assert.equal(reminderMessage(1, 3), "One habit left to fill in today.");
  assert.equal(reminderMessage(2, 3), "2 habits left to fill in today.");
  assert.equal(reminderMessage(3, 3), "None of your 3 habits are done yet today.");
});

test("periodStartKey finds Monday and the 1st", () => {
  assert.equal(periodStartKey("2026-11-04", "week"), "2026-11-02"); // Wed → Mon
  assert.equal(periodStartKey("2026-11-08", "week"), "2026-11-02"); // Sun → Mon
  assert.equal(periodStartKey("2026-11-02", "week"), "2026-11-02");
  assert.equal(periodStartKey("2026-11-04", "month"), "2026-11-01");
});

test("isHabitDue follows the schedule", () => {
  assert.equal(isHabitDue({}, "2026-11-04"), true);
  assert.equal(isHabitDue({ schedule: { type: "daily" } }, "2026-11-04"), true);
  // 2026-11-04 is a Wednesday (3).
  assert.equal(isHabitDue({ schedule: { type: "days", days: [1, 3, 5] } }, "2026-11-04"), true);
  assert.equal(isHabitDue({ schedule: { type: "days", days: [2, 4] } }, "2026-11-04"), false);
  const weekly = { schedule: { type: "period", period: "week", times: 3 } };
  assert.equal(isHabitDue(weekly, "2026-11-04", 2), true);
  assert.equal(isHabitDue(weekly, "2026-11-04", 3), false);
  const every3 = { schedule: { type: "interval", every: 3 } };
  assert.equal(isHabitDue(every3, "2026-11-04", 0), true);
  assert.equal(isHabitDue(every3, "2026-11-04", 1), false);
  assert.equal(isHabitDue({ goalType: "limit" }, "2026-11-04"), false);
});

test("windowStartKey", () => {
  assert.equal(windowStartKey({ type: "interval", every: 3 }, "2026-11-04"), "2026-11-02");
  assert.equal(windowStartKey({ type: "period", period: "month", times: 2 }, "2026-11-04"), "2026-11-01");
  assert.equal(windowStartKey({ type: "daily" }, "2026-11-04"), null);
});

test("isMorningDue only fires before noon", () => {
  const r = { enabled: true, time: "20:00", morningTime: "08:00", timezone: "Asia/Singapore" };
  // 01:30 UTC = 09:30 SGT
  assert.equal(isMorningDue(r, new Date("2026-11-04T01:30:00Z")).due, true);
  // 12:10 UTC = 20:10 SGT
  assert.equal(isMorningDue(r, now).due, false);
  assert.equal(isMorningDue({ ...r, morningTime: null }, new Date("2026-11-04T01:30:00Z")).due, false);
  assert.equal(
    isMorningDue({ ...r, lastMorningSentDate: "2026-11-04" }, new Date("2026-11-04T01:30:00Z")).due,
    false
  );
});
