"use client";

import * as React from "react";
import {
  Cake,
  ChevronRight,
  Hourglass,
  Minus,
  Plus,
  Sparkles,
} from "lucide-react";
import Link from "next/link";

import { Divider, Group, Row, RowIcon } from "@/components/grouped-list";
import { FieldError } from "@/components/ui/field";
import { useLifeProfile } from "@/hooks/use-life-profile";
import { haptic } from "@/lib/haptics";
import {
  DEFAULT_LIFE_EXPECTANCY,
  MAX_LIFE_EXPECTANCY,
  MIN_LIFE_EXPECTANCY,
  saveLifeProfile,
  validateLifeProfile,
} from "@/lib/life";
import { todayKey } from "@/lib/dates";
import { nav } from "@/lib/transitions";

/** Settings section: date of birth + life expectancy, saved as you edit. */
export function LifeSettings({ uid }: { uid: string }) {
  const { profile, loading } = useLifeProfile(uid);
  const [birthDate, setBirthDate] = React.useState("");
  const [years, setYears] = React.useState(DEFAULT_LIFE_EXPECTANCY);
  const [error, setError] = React.useState<string | null>(null);
  const [synced, setSynced] = React.useState(false);

  // Adopt the stored values once they load (and if another device changes them).
  const storedKey = profile
    ? `${profile.birthDate}|${profile.lifeExpectancy}`
    : "";
  const [lastStored, setLastStored] = React.useState<string | null>(null);
  if (!loading && storedKey !== lastStored) {
    setLastStored(storedKey);
    if (profile) {
      setBirthDate(profile.birthDate);
      setYears(profile.lifeExpectancy);
    }
    setSynced(true);
  }

  function commit(nextBirth: string, nextYears: number) {
    if (!nextBirth) return; // Nothing to save until a birthday is set.
    const problem = validateLifeProfile(nextBirth, nextYears);
    setError(problem);
    if (problem) return;
    saveLifeProfile(uid, {
      birthDate: nextBirth,
      lifeExpectancy: nextYears,
    }).catch(() =>
      setError("Couldn't save. Check your connection and try again."),
    );
  }

  function step(delta: number) {
    const next = Math.min(
      MAX_LIFE_EXPECTANCY,
      Math.max(MIN_LIFE_EXPECTANCY, years + delta),
    );
    if (next === years) return;
    haptic();
    setYears(next);
    commit(birthDate, next);
  }

  return (
    <Group
      label="Your Life"
      footer={
        <>
          Used to draw your life in weeks. Only you can see this.
          {error && <FieldError className="mt-1.5">{error}</FieldError>}
        </>
      }
    >
      <Row
        label="Birthday"
        htmlFor="birth-date"
        icon={
          <RowIcon className="bg-[#b8502f]">
            <Cake />
          </RowIcon>
        }
      >
        <input
          id="birth-date"
          type="date"
          value={birthDate}
          max={todayKey()}
          disabled={!synced}
          onChange={(e) => {
            setBirthDate(e.target.value);
            commit(e.target.value, years);
          }}
          className="min-h-8 rounded-lg bg-foreground/[0.07] px-2.5 py-1 text-[17px] tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        />
      </Row>
      <Divider inset={58} />
      <Row
        label="Life Expectancy"
        icon={
          <RowIcon className="bg-[#4f5d70]">
            <Hourglass />
          </RowIcon>
        }
      >
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Decrease life expectancy"
            disabled={!synced || years <= MIN_LIFE_EXPECTANCY}
            onClick={() => step(-1)}
            className="pressable flex size-8 items-center justify-center rounded-full bg-foreground/[0.07] disabled:opacity-40 [&_svg]:size-4"
          >
            <Minus />
          </button>
          <span
            className="w-16 text-center text-[17px] tabular-nums"
            aria-live="polite"
          >
            {years} yrs
          </span>
          <button
            type="button"
            aria-label="Increase life expectancy"
            disabled={!synced || years >= MAX_LIFE_EXPECTANCY}
            onClick={() => step(1)}
            className="pressable flex size-8 items-center justify-center rounded-full bg-foreground/[0.07] disabled:opacity-40 [&_svg]:size-4"
          >
            <Plus />
          </button>
        </div>
      </Row>
      <Divider inset={58} />
      <Link
        href="/life"
        transitionTypes={nav("push")}
        className="tappable flex min-h-12 items-center gap-3 px-4 py-1.5 text-[17px]"
      >
        <RowIcon className="bg-[#22242e] dark:bg-[#5c5a55]">
          <Sparkles />
        </RowIcon>
        <span className="flex-1">Life in Weeks</span>
        <ChevronRight className="size-5 text-muted-foreground/60" />
      </Link>
    </Group>
  );
}
