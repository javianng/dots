"use client";

import * as React from "react";

import { LifeFields } from "@/components/life-fields";
import { LifeGrid } from "@/components/life-grid";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/hooks/use-auth";
import { useLifeProfile } from "@/hooks/use-life-profile";
import {
  DEFAULT_LIFE_EXPECTANCY,
  lifeStats,
  saveLifeProfile,
  validateLifeProfile,
  type LifeProfile,
} from "@/lib/life";
import { cn } from "@/lib/utils";

/** The "Life" tab on the home screen: your life in weeks, or set-up if no birthday yet. */
export function LifePanel() {
  const { user } = useAuth();
  const { profile, loading } = useLifeProfile(user?.uid);

  if (loading || !user) {
    return (
      <div className="mx-auto flex w-full max-w-xl flex-col gap-4 pt-2">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="aspect-[3/5] w-full rounded-2xl" />
      </div>
    );
  }
  return profile ? (
    <LifeView profile={profile} />
  ) : (
    <LifeSetup uid={user.uid} />
  );
}

/** Matches the grid fill in globals.css (.life-lived / .life-bar). */
const FILL_MS = 1300;
const FILL_DELAY_MS = 120;
const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

/** Animates from `from` to `target` once on mount, in step with the grid fill. */
function useCountUp(target: number, from = 0) {
  const [value, setValue] = React.useState(from);
  // Clock starts at mount, like the CSS fill. Effects can run a few hundred ms
  // later (after the tab's view transition), so don't start timing there.
  const [mountedAt] = React.useState(() => performance.now());
  React.useEffect(() => {
    const ms = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? 0
      : FILL_MS;
    let frame = 0;
    const start = mountedAt + (ms ? FILL_DELAY_MS : 0);
    const tick = (now: number) => {
      const t = ms ? Math.min(1, Math.max(0, (now - start) / ms)) : 1;
      setValue(from + (target - from) * easeInOutCubic(t));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, from, mountedAt]);
  return value;
}

function LifeView({ profile }: { profile: LifeProfile }) {
  const stats = lifeStats(profile);
  const percent = stats.fractionLived * 100;
  const shownPercent = useCountUp(percent);

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-5 pt-2">
      <section className="flex flex-col">
        <span className="text-[13px] font-semibold tracking-wide text-muted-foreground uppercase">
          Week {stats.weekOfYear + 1} of age {stats.ageYears}
        </span>
        <h1 className="text-[34px] leading-tight font-bold tracking-tight tabular-nums">
          {percent < 10 ? shownPercent.toFixed(1) : Math.round(shownPercent)}%
          lived
        </h1>
        <div
          className="mt-3 h-1.5 overflow-hidden rounded-full bg-foreground/10"
          role="progressbar"
          aria-valuenow={Math.round(percent)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Share of your expected life lived"
        >
          <div
            className="life-bar h-full rounded-full bg-foreground"
            style={{ width: `${percent}%` }}
          />
        </div>
      </section>

      <div className="grid grid-cols-3 gap-2">
        <Stat label="Weeks lived" value={stats.weeksLived} i={0} />
        <Stat
          label="Weeks left"
          value={stats.weeksLeft}
          from={stats.totalWeeks}
          accent
          i={1}
        />
        <Stat label="Of" value={stats.totalWeeks} from={stats.totalWeeks} i={2} />
      </div>

      <Card
        className="animate-rise py-4"
        style={{ "--i": 3 } as React.CSSProperties}
      >
        <CardContent className="px-3">
          <LifeGrid stats={stats} years={profile.lifeExpectancy} />
        </CardContent>
      </Card>

      <p className="px-1 text-center text-[13px] leading-snug text-muted-foreground">
        Each dot is a week of a {profile.lifeExpectancy}-year life. The orange
        one is this week. Change your birthday or life expectancy in Settings.
      </p>
    </div>
  );
}

function Stat({
  label,
  value,
  from = 0,
  accent,
  i,
}: {
  label: string;
  value: number;
  /** Where the number animates from: lived counts up, left counts down. */
  from?: number;
  accent?: boolean;
  i: number;
}) {
  const shown = useCountUp(value, from);
  return (
    <div
      style={{ "--i": i } as React.CSSProperties}
      className="shadow-card animate-rise flex flex-col rounded-2xl bg-card px-3 py-2.5 ring-1 ring-black/[0.03] dark:ring-white/[0.06]"
    >
      <span
        className={cn(
          "text-[20px] leading-tight font-bold tabular-nums",
          accent && "text-accent-text",
        )}
      >
        {Math.round(shown).toLocaleString()}
      </span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

/** Shown when the user hasn't told us their birthday yet (e.g. Google sign-up). */
function LifeSetup({ uid }: { uid: string }) {
  const [birthDate, setBirthDate] = React.useState("");
  const [years, setYears] = React.useState(String(DEFAULT_LIFE_EXPECTANCY));
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const lifeExpectancy = Number(years);
    const problem = validateLifeProfile(birthDate, lifeExpectancy);
    setError(problem);
    if (problem) return;
    setPending(true);
    try {
      await saveLifeProfile(uid, { birthDate, lifeExpectancy });
    } catch {
      setError("Couldn't save. Check your connection and try again.");
      setPending(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-6 py-12">
      <div className="flex flex-col gap-1 text-center">
        <h1 className="text-[28px] leading-tight font-bold tracking-tight">
          Your life in dots
        </h1>
        <p className="max-w-72 text-[15px] text-muted-foreground">
          Every week of your life as one dot. Tell us when you were born to see
          how far along you are.
        </p>
      </div>
      <form onSubmit={handleSubmit} className="w-full max-w-sm">
        <LifeFields
          birthDate={birthDate}
          onBirthDateChange={setBirthDate}
          years={years}
          onYearsChange={setYears}
          error={error}
        />
        <Button
          type="submit"
          size="lg"
          className="mt-4 w-full"
          disabled={pending}
        >
          {pending && <Spinner data-icon="inline-start" />}
          Show My Life
        </Button>
      </form>
    </div>
  );
}
