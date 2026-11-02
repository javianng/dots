"use client";

import * as React from "react";
import { Bell, Clock, Share } from "lucide-react";

import { Divider, Group, Row, RowIcon } from "@/components/grouped-list";
import { FieldError } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import {
  DEFAULT_REMINDER_TIME,
  currentTimeZone,
  disableReminders,
  enableReminders,
  getDeviceSubscription,
  getPushSupport,
  loadReminderSettings,
  saveReminderSettings,
  type PushSupport,
} from "@/lib/push";

export function ReminderSettings({ uid }: { uid: string }) {
  const [support, setSupport] = React.useState<PushSupport | null>(null);
  const [enabled, setEnabled] = React.useState(false);
  const [time, setTime] = React.useState(DEFAULT_REMINDER_TIME);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    const nextSupport = getPushSupport();

    (async () => {
      const [settings, subscription] = await Promise.all([
        loadReminderSettings(uid).catch(() => null),
        getDeviceSubscription().catch(() => null),
      ]);
      if (cancelled) return;
      setSupport(nextSupport);
      if (settings?.time) setTime(settings.time);
      // "On" means reminders are enabled AND this device is subscribed.
      setEnabled(Boolean(settings?.enabled && subscription));
    })();

    return () => {
      cancelled = true;
    };
  }, [uid]);

  // Called straight from the switch's tap so iOS will show the permission prompt.
  function handleToggle(checked: boolean) {
    setError(null);
    setBusy(true);
    const action = checked ? enableReminders(uid, time) : disableReminders(uid);
    action
      .then(() => setEnabled(checked))
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Something went wrong.");
        setEnabled(!checked);
      })
      .finally(() => setBusy(false));
  }

  function handleTimeChange(next: string) {
    if (!next) return;
    setTime(next);
    if (!enabled) return;
    saveReminderSettings(uid, {
      time: next,
      timezone: currentTimeZone(),
      // Allow a reminder later today if the new time hasn't passed yet.
      lastSentDate: null,
    }).catch(() => setError("Couldn't save the reminder time."));
  }

  const unavailable = support !== "supported";

  let footer: React.ReactNode = "A daily nudge if you haven't filled in today's dots.";
  if (support === "ios-needs-install") {
    footer = (
      <>
        To get reminders on iPhone or iPad, tap{" "}
        <Share className="inline size-3.5 -translate-y-px" aria-label="Share" /> in
        Safari, choose <strong className="font-semibold">Add to Home Screen</strong>, then
        open dots from your Home Screen.
      </>
    );
  } else if (support === "unsupported") {
    footer = "This browser doesn't support notifications.";
  }

  return (
    <Group
      label="Notifications"
      footer={
        <>
          {footer}
          {error && <FieldError className="mt-1.5">{error}</FieldError>}
        </>
      }
    >
      <Row
        label="Daily Reminder"
        htmlFor="reminders"
        icon={
          <RowIcon className="bg-[#b8502f]">
            <Bell />
          </RowIcon>
        }
      >
        <Switch
          id="reminders"
          checked={enabled}
          disabled={support === null || unavailable || busy}
          onCheckedChange={handleToggle}
        />
      </Row>
      <div
        className="grid transition-[grid-template-rows] duration-300 ease-(--ease-ios)"
        style={{ gridTemplateRows: enabled ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <Divider inset={58} />
          <Row
            label="Time"
            htmlFor="reminder-time"
            icon={
              <RowIcon className="bg-[#9c6b12]">
                <Clock />
              </RowIcon>
            }
          >
            <input
              id="reminder-time"
              type="time"
              value={time}
              tabIndex={enabled ? 0 : -1}
              onChange={(e) => handleTimeChange(e.target.value)}
              className="rounded-lg bg-foreground/[0.07] px-2.5 py-1 text-[17px] tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            />
          </Row>
        </div>
      </div>
    </Group>
  );
}
