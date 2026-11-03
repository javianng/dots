"use client";

import * as React from "react";

import { BackButton } from "@/components/back-button";
import { LifeFields } from "@/components/life-fields";
import { LifeGrid } from "@/components/life-grid";
import { RequireAuth } from "@/components/require-auth";
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
import { PageTransition } from "@/lib/transitions";
import { cn } from "@/lib/utils";

export default function LifePage() {
  return (
    <PageTransition>
      <RequireAuth>
        <LifeScreen />
      </RequireAuth>
    </PageTransition>
  );
}

function LifeScreen() {
  const { user } = useAuth();
  const { profile, loading } = useLifeProfile(user?.uid);

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col px-4 pb-12">
      <header className="material bar-edge pt-safe sticky top-0 z-20 -mx-4 px-4">
        <div className="grid h-14 grid-cols-[1fr_auto_1fr] items-center">
          <span className="justify-self-start">
            <BackButton />
          </span>
          <h1 className="font-sans text-[17px] font-semibold">Life in Weeks</h1>
          <span />
        </div>
      </header>

      {loading ? (
        <div className="flex flex-col gap-4 pt-4">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="aspect-[3/5] w-full rounded-2xl" />
        </div>
      ) : profile && user ? (
        <LifeView profile={profile} />
      ) : (
        user && <LifeSetup uid={user.uid} />
      )}
    </main>
  );
}

function LifeView({ profile }: { profile: LifeProfile }) {
  const stats = lifeStats(profile);
  const percent = stats.fractionLived * 100;

  return (
    <div className="flex flex-col gap-5 pt-2">
      <section className="flex flex-col">
        <span className="text-[13px] font-semibold tracking-wide text-muted-foreground uppercase">
          Week {stats.weekOfYear + 1} of age {stats.ageYears}
        </span>
        <h2 className="text-[34px] leading-tight font-bold tracking-tight tabular-nums">
          {percent < 10 ? percent.toFixed(1) : Math.round(percent)}% lived
        </h2>
        <div
          className="mt-3 h-1.5 overflow-hidden rounded-full bg-foreground/10"
          role="progressbar"
          aria-valuenow={Math.round(percent)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Share of your expected life lived"
        >
          <div
            className="h-full rounded-full bg-foreground"
            style={{ width: `${percent}%` }}
          />
        </div>
      </section>

      <div className="grid grid-cols-3 gap-2">
        <Stat label="Weeks lived" value={stats.weeksLived} />
        <Stat label="Weeks left" value={stats.weeksLeft} accent />
        <Stat label="Of" value={stats.totalWeeks} />
      </div>

      <Card className="py-4">
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
  accent,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div className="shadow-card flex flex-col rounded-2xl bg-card px-3 py-2.5 ring-1 ring-black/[0.03] dark:ring-white/[0.06]">
      <span
        className={cn(
          "text-[20px] leading-tight font-bold tabular-nums",
          accent && "text-accent-text",
        )}
      >
        {value.toLocaleString()}
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
    <div className="flex flex-1 flex-col items-center justify-center gap-6 py-12">
      <div className="flex flex-col gap-1 text-center">
        <h2 className="text-[28px] leading-tight font-bold tracking-tight">
          Your life in dots
        </h2>
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
