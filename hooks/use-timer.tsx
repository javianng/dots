"use client";

import * as React from "react";

import { useAuth } from "@/hooks/use-auth";
import { useHabits } from "@/hooks/use-habits";
import { completeDay } from "@/lib/check-in";
import { dayTarget } from "@/lib/schedule";

/** Re-renders every second while `active`, returning the current time. */
export function useNow(active: boolean) {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [active]);
  return now;
}

/**
 * Mounted once at the app root: when a running countdown reaches zero it
 * logs the day as done, stops the timer and celebrates, whichever screen is
 * open. A countdown that ran out while the app was closed is finished as
 * soon as the app opens again (the elapsed time comes from `startedAt`).
 */
export function TimerRunner() {
  const { user } = useAuth();
  const { habits } = useHabits();
  const finishing = React.useRef(new Set<string>());

  React.useEffect(() => {
    if (!user || !habits) return;
    const timeouts: number[] = [];
    for (const habit of habits) {
      if (!habit.timer) {
        finishing.current.delete(habit.id);
        continue;
      }
      const { dateKey, startedAt } = habit.timer;
      const remainingMs =
        (dayTarget(habit) - (habit.counts[dateKey] ?? 0)) * 1000 - (Date.now() - startedAt);
      const finish = () => {
        if (finishing.current.has(habit.id)) return;
        finishing.current.add(habit.id);
        completeDay(user.uid, habit, dateKey)?.catch(() => finishing.current.delete(habit.id));
        notifyDone(habit.name);
      };
      if (remainingMs <= 0) finish();
      else timeouts.push(window.setTimeout(finish, remainingMs));
    }
    return () => timeouts.forEach((id) => window.clearTimeout(id));
  }, [user, habits]);

  return null;
}

/**
 * A system notification when the countdown ends with the app in the
 * background (only if notifications are already allowed for reminders).
 */
function notifyDone(name: string) {
  try {
    if (document.visibilityState === "visible") return;
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    navigator.serviceWorker?.ready
      .then((reg) =>
        reg.showNotification("Time's up", { body: `${name} is done for today.`, tag: `dots-timer-${name}` })
      )
      .catch(() => {});
  } catch {
    // Best effort only.
  }
}
