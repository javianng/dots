import { doc, setDoc } from "firebase/firestore";

import { db } from "@/lib/firebase";

/**
 * "Your life in weeks" (after Wait But Why): one dot per week, one row per
 * year of life, 52 dots to a row.
 *
 * Firestore layout:
 *   users/{uid}.life → { birthDate: "YYYY-MM-DD", lifeExpectancy: number }
 */

export interface LifeProfile {
  /** Local 'YYYY-MM-DD'. */
  birthDate: string;
  /** Expected lifespan in whole years. */
  lifeExpectancy: number;
}

export const WEEKS_PER_YEAR = 52;
export const DEFAULT_LIFE_EXPECTANCY = 90;
export const MIN_LIFE_EXPECTANCY = 1;
export const MAX_LIFE_EXPECTANCY = 120;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Parse 'YYYY-MM-DD' as local midnight (not UTC). */
export function parseDateKey(key: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!match) return null;
  const [, y, m, d] = match.map(Number);
  const date = new Date(y, m - 1, d);
  return date.getMonth() === m - 1 && date.getDate() === d ? date : null;
}

/** Calendar-safe "the same date `years` later" (29 Feb → 28 Feb). */
function addYears(date: Date, years: number): Date {
  const next = new Date(date.getFullYear() + years, date.getMonth(), 1);
  const lastDay = new Date(
    next.getFullYear(),
    next.getMonth() + 1,
    0,
  ).getDate();
  next.setDate(Math.min(date.getDate(), lastDay));
  return next;
}

/** Whole days between two local dates, immune to DST shifts. */
function daysBetween(a: Date, b: Date): number {
  const utcA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const utcB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.floor((utcB - utcA) / DAY_MS);
}

/** Returns an error message, or null if the profile is valid. */
export function validateLifeProfile(
  birthDate: string,
  lifeExpectancy: number,
  today = new Date(),
): string | null {
  const birth = parseDateKey(birthDate);
  if (!birth) return "Enter your date of birth.";
  if (daysBetween(birth, today) < 0)
    return "Your birthday can't be in the future.";
  if (!Number.isInteger(lifeExpectancy))
    return "Life expectancy should be a whole number of years.";
  if (
    lifeExpectancy < MIN_LIFE_EXPECTANCY ||
    lifeExpectancy > MAX_LIFE_EXPECTANCY
  ) {
    return `Life expectancy should be between ${MIN_LIFE_EXPECTANCY} and ${MAX_LIFE_EXPECTANCY} years.`;
  }
  const age = lifeStats({ birthDate, lifeExpectancy }, today).ageYears;
  if (age >= lifeExpectancy) {
    return `You're already ${age} — set a life expectancy above that.`;
  }
  return null;
}

export interface LifeStats {
  ageYears: number;
  /** Week of the current year of life, 0-based, capped at 51. */
  weekOfYear: number;
  /** Index of the current dot in the grid (ageYears * 52 + weekOfYear). */
  currentWeek: number;
  totalWeeks: number;
  weeksLived: number;
  weeksLeft: number;
  /** 0–1. */
  fractionLived: number;
}

/**
 * Rows follow birthdays, so each row really is one year of life; the last
 * day or so of a 365/366-day year folds into dot 52.
 */
export function lifeStats(profile: LifeProfile, today = new Date()): LifeStats {
  const birth = parseDateKey(profile.birthDate) ?? today;
  const totalWeeks = profile.lifeExpectancy * WEEKS_PER_YEAR;

  let ageYears = today.getFullYear() - birth.getFullYear();
  if (addYears(birth, ageYears) > today) ageYears -= 1;
  ageYears = Math.max(0, ageYears);

  const lastBirthday = addYears(birth, ageYears);
  const weekOfYear = Math.min(
    WEEKS_PER_YEAR - 1,
    Math.floor(daysBetween(lastBirthday, today) / 7),
  );

  const currentWeek = Math.min(
    totalWeeks,
    ageYears * WEEKS_PER_YEAR + weekOfYear,
  );
  const weeksLived = currentWeek;
  const weeksLeft = Math.max(0, totalWeeks - currentWeek);

  return {
    ageYears,
    weekOfYear,
    currentWeek,
    totalWeeks,
    weeksLived,
    weeksLeft,
    fractionLived: totalWeeks ? Math.min(1, weeksLived / totalWeeks) : 0,
  };
}

/** Read `users/{uid}.life` from a user doc's data, if it's well-formed. */
export function lifeProfileFrom(
  data: Record<string, unknown> | undefined,
): LifeProfile | null {
  const life = data?.life as Partial<LifeProfile> | undefined;
  if (
    !life ||
    typeof life.birthDate !== "string" ||
    !parseDateKey(life.birthDate) ||
    typeof life.lifeExpectancy !== "number"
  ) {
    return null;
  }
  return { birthDate: life.birthDate, lifeExpectancy: life.lifeExpectancy };
}

export async function saveLifeProfile(uid: string, profile: LifeProfile) {
  await setDoc(
    doc(db, "users", uid),
    {
      life: {
        birthDate: profile.birthDate,
        lifeExpectancy: Math.round(profile.lifeExpectancy),
      },
    },
    { merge: true },
  );
}
