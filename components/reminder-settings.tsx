"use client";

import * as React from "react";
import { Share } from "lucide-react";

import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
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
        setEnabled(false);
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

  return (
    <div className="flex flex-col gap-3">
      <Field orientation="horizontal">
        <FieldContent>
          <FieldLabel htmlFor="reminders">Reminders</FieldLabel>
          <FieldDescription>
            A daily nudge if you haven&apos;t filled in today&apos;s dots.
          </FieldDescription>
        </FieldContent>
        <Switch
          id="reminders"
          checked={enabled}
          disabled={support === null || unavailable || busy}
          onCheckedChange={handleToggle}
        />
      </Field>

      {enabled && (
        <Field orientation="horizontal">
          <FieldLabel htmlFor="reminder-time">Remind me at</FieldLabel>
          <Input
            id="reminder-time"
            type="time"
            value={time}
            onChange={(e) => handleTimeChange(e.target.value)}
            className="w-28"
          />
        </Field>
      )}

      {support === "ios-needs-install" && (
        <p className="text-xs/relaxed text-muted-foreground">
          To get reminders on iPhone or iPad, add dots to your Home Screen: tap{" "}
          <Share className="inline size-3.5 align-text-bottom" aria-label="Share" />{" "}
          in Safari, choose <strong>Add to Home Screen</strong>, then open dots
          from there.
        </p>
      )}
      {support === "unsupported" && (
        <p className="text-xs/relaxed text-muted-foreground">
          This browser doesn&apos;t support notifications.
        </p>
      )}
      {error && <FieldError>{error}</FieldError>}
    </div>
  );
}
