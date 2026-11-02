"use client";

import { celebrateCompletion } from "@/components/celebrate-toast";
import { HabitIcon } from "@/components/habit-icon";
import { HEATMAP_WEEKS, Heatmap } from "@/components/heatmap";
import { MonthCalendar } from "@/components/month-calendar";
import { RequireAuth } from "@/components/require-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { useHabits } from "@/hooks/use-habits";
import { currentStreak } from "@/lib/dates";
import { setCompletion } from "@/lib/habits";
import { HabitIconTransition, PageTransition, nav } from "@/lib/transitions";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";

export default function HabitDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = React.use(params);
  return (
    <PageTransition>
      <RequireAuth>
        <HabitDetail habitId={id} />
      </RequireAuth>
    </PageTransition>
  );
}

function HabitDetail({ habitId }: { habitId: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const { habits, loading } = useHabits();
  const [calMonthOffset, setCalMonthOffset] = React.useState(0);

  const habit = habits?.find((h) => h.id === habitId);

  React.useEffect(() => {
    if (!loading && habits && !habit) router.replace("/");
  }, [loading, habits, habit, router]);

  if (loading || !habit) {
    return (
      <div className="mx-auto flex w-full max-w-xl flex-col gap-4 p-4 lg:max-w-4xl">
        <Skeleton className="h-14 w-full rounded-2xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-72 w-full rounded-2xl" />
      </div>
    );
  }

  const streak = currentStreak(habit.history);
  const total = Object.values(habit.history).filter(Boolean).length;
  const goal = habit.streakGoal;
  const goalProgress = goal ? Math.min(1, streak / goal) : 0;

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col px-4 pb-10 lg:max-w-4xl">
      <header className="material bar-edge pt-safe sticky top-0 z-20 -mx-4 px-2">
        <div className="flex h-14 items-center justify-between">
          <Button
            variant="ghost"
            className="h-10 gap-0.5 rounded-full px-2 text-[17px] font-normal"
            nativeButton={false}
            render={<Link href="/" transitionTypes={nav("pop")} />}
          >
            <ChevronLeft className="size-6" strokeWidth={2.25} />
            Habits
          </Button>
          <Button
            variant="ghost"
            className="h-10 rounded-full px-3 text-[17px] font-normal"
            nativeButton={false}
            render={
              <Link href={`/habits/${habit.id}/edit`} transitionTypes={nav("sheetUp")} />
            }
          >
            Edit
          </Button>
        </div>
      </header>

      <section className="flex items-center gap-4 pt-3 pb-6">
        <HabitIconTransition habitId={habit.id}>
          <HabitIcon
            habitId={habit.id}
            icon={habit.icon}
            colorHex={habit.colorHex}
            className="size-16 rounded-2xl [&_svg]:size-8"
          />
        </HabitIconTransition>
        <div className="flex min-w-0 flex-1 flex-col">
          <h1 className="truncate text-[28px] leading-tight font-bold tracking-tight">
            {habit.name}
          </h1>
          {habit.description && (
            <p className="line-clamp-2 text-[15px] text-muted-foreground">
              {habit.description}
            </p>
          )}
        </div>
      </section>

      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[1fr_22rem] lg:items-start lg:gap-6">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Streak" value={streak} unit={streak === 1 ? "day" : "days"} />
            <Stat
              label="Goal"
              value={goal ?? "–"}
              unit={goal ? "days" : "not set"}
              progress={goal ? goalProgress : undefined}
              colorHex={habit.colorHex}
            />
            <Stat label="Total" value={total} unit={total === 1 ? "day" : "days"} />
          </div>

          <Card>
            <CardContent className="flex flex-col gap-3">
              <SectionTitle>Last 6 months</SectionTitle>
              <Heatmap
                history={habit.history}
                colorHex={habit.colorHex}
                weeks={HEATMAP_WEEKS}
                showMonthLabels
                showWeekdayLabels
              />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent>
            <MonthCalendar
              history={habit.history}
              colorHex={habit.colorHex}
              monthOffset={calMonthOffset}
              onMonthOffsetChange={setCalMonthOffset}
              onToggleDay={(dateKey) => {
                if (!user) return;
                const nextDone = !habit.history[dateKey];
                if (nextDone) celebrateCompletion(habit, dateKey);
                setCompletion(user.uid, habit.id, dateKey, nextDone);
              }}
            />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-sans text-[13px] font-semibold tracking-wide text-muted-foreground uppercase">
      {children}
    </h2>
  );
}

function Stat({
  label,
  value,
  unit,
  progress,
  colorHex,
}: {
  label: string;
  value: number | string;
  unit: string;
  progress?: number;
  colorHex?: string;
}) {
  return (
    <Card size="sm" className="gap-1 px-3.5 py-3">
      <span className="text-[13px] font-medium text-muted-foreground">{label}</span>
      <span className="flex items-baseline gap-1">
        <span className="text-2xl leading-none font-bold tracking-tight tabular-nums">
          {value}
        </span>
        <span className="truncate text-xs text-muted-foreground">{unit}</span>
      </span>
      {progress !== undefined && (
        <span className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-foreground/10">
          <span
            className="block h-full origin-left rounded-full transition-transform duration-700 ease-(--ease-spring)"
            style={{ backgroundColor: colorHex, transform: `scaleX(${progress})` }}
          />
        </span>
      )}
    </Card>
  );
}
