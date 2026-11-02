import assert from "node:assert/strict";
import { test } from "node:test";

import {
  isDue,
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
  assert.equal(isDue({ ...base, time: "17:00" }, now).due, false); // >2h late
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
