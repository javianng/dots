import {
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  collection,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

import { db } from "@/lib/firebase";

/**
 * Web Push helpers for daily reminders.
 *
 * Firestore layout:
 *   users/{uid}.reminder                     → { enabled, time: "HH:mm", timezone, lastSentDate }
 *   users/{uid}/pushSubscriptions/{id}       → one doc per subscribed device
 *
 * Notifications are sent by scripts/reminders (run on a schedule by GitHub Actions).
 */

export interface ReminderSettings {
  enabled: boolean;
  /** Local time of day, 24h "HH:mm". */
  time: string;
  /** IANA time zone, e.g. "Asia/Singapore". */
  timezone: string;
  /** Local 'YYYY-MM-DD' of the last reminder sent (written by the sender). */
  lastSentDate?: string | null;
  /** Optional morning nudge for morning habits, "HH:mm"; null = off. */
  morningTime?: string | null;
  lastMorningSentDate?: string | null;
}

export const DEFAULT_REMINDER_TIME = "20:00";
export const DEFAULT_MORNING_TIME = "07:30";

export type PushSupport =
  | "supported"
  /** iOS Safari tab: push only works once dots is added to the Home Screen. */
  | "ios-needs-install"
  | "unsupported";

export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    // iPadOS reports itself as a Mac.
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function getPushSupport(): PushSupport {
  if (typeof window === "undefined") return "unsupported";
  const hasApis =
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window;
  if (isIOS() && !isStandalone()) return "ios-needs-install";
  return hasApis ? "supported" : "unsupported";
}

export function currentTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

/**
 * Built by Serwist from app/sw.ts (offline caching + push). Registering it at
 * scope "/" replaces the old /sw.js registration, keeping push subscriptions.
 */
const SERVICE_WORKER_URL = "/serwist/sw.js";

export function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return Promise.resolve(null);
  }
  return navigator.serviceWorker
    .register(SERVICE_WORKER_URL, { scope: "/", updateViaCache: "none" })
    .catch((error) => {
      console.error("Service worker registration failed", error);
      return null;
    });
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const output = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

/** Stable Firestore doc id for a subscription, derived from its endpoint. */
async function subscriptionId(endpoint: string): Promise<string> {
  const bytes = new TextEncoder().encode(endpoint);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash))
    .slice(0, 16)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function subscriptionsCollection(uid: string) {
  return collection(db, "users", uid, "pushSubscriptions");
}

export async function getDeviceSubscription(): Promise<PushSubscription | null> {
  if (getPushSupport() !== "supported") return null;
  const registration = await navigator.serviceWorker.getRegistration("/");
  return (await registration?.pushManager.getSubscription()) ?? null;
}

export async function loadReminderSettings(
  uid: string
): Promise<ReminderSettings | null> {
  const snap = await getDoc(doc(db, "users", uid));
  return (snap.data()?.reminder as ReminderSettings | undefined) ?? null;
}

export async function saveReminderSettings(
  uid: string,
  settings: Partial<ReminderSettings>
) {
  await setDoc(doc(db, "users", uid), { reminder: settings }, { merge: true });
}

/**
 * Ask for permission and subscribe this device. Must be called directly from a
 * user gesture (a tap), or iOS will refuse to show the permission prompt.
 */
export async function enableReminders(uid: string, time: string) {
  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidKey) {
    throw new Error("Reminders aren't configured yet (missing VAPID key).");
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error(
      permission === "denied"
        ? "Notifications are blocked. Turn them on for dots in your device settings."
        : "Notification permission wasn't granted."
    );
  }

  const registration =
    (await navigator.serviceWorker.getRegistration("/")) ??
    (await registerServiceWorker());
  if (!registration) throw new Error("Couldn't set up the service worker.");
  await navigator.serviceWorker.ready;

  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    }));

  const json = subscription.toJSON();
  const id = await subscriptionId(subscription.endpoint);
  await setDoc(doc(subscriptionsCollection(uid), id), {
    endpoint: json.endpoint,
    keys: json.keys,
    userAgent: navigator.userAgent,
    createdAt: serverTimestamp(),
  });

  await saveReminderSettings(uid, {
    enabled: true,
    time,
    timezone: currentTimeZone(),
  });
}

/** Unsubscribe this device. Reminders stay on if another device is still subscribed. */
export async function disableReminders(uid: string) {
  const subscription = await getDeviceSubscription();
  if (subscription) {
    const id = await subscriptionId(subscription.endpoint);
    // Unsubscribe first: it stops pushes even if the delete below can't reach
    // Firestore, and the sender removes the dead subscription on its next send.
    await subscription.unsubscribe().catch(() => undefined);
    await deleteDoc(doc(subscriptionsCollection(uid), id));
  }

  const remaining = await getDocs(subscriptionsCollection(uid));
  if (remaining.empty) {
    await saveReminderSettings(uid, { enabled: false });
  }
}
