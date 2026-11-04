"use client";

import { HabitIcon } from "@/components/habit-icon";
import { HEATMAP_WEEKS, Heatmap } from "@/components/heatmap";
import { MonthCalendar } from "@/components/month-calendar";
import { RequireAuth } from "@/components/require-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useHabits } from "@/hooks/use-habits";
import { DayPanel } from "@/components/day-panel";
import { todayKey } from "@/lib/dates";
import { dayTarget, goalLabel, habitStreak, partsLabel, scheduleLabel, withUnit } from "@/lib/schedule";
import { HabitIconTransition, PageTransition, nav } from "@/lib/transitions";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { habitTint } from "@/lib/palette";
import { editHabitHref } from "@/lib/routes";

export default function HabitDetailPage() {
  return (
    <PageTransition>
      <RequireAuth>
        {/* useSearchParams needs a Suspense boundary to keep the page static. */}
        <React.Suspense fallback={null}>
          <HabitDetailFromQuery />
        </React.Suspense>
      </RequireAuth>
    </PageTransition>
  );
}

function HabitDetailFromQuery() {
  const id = useSearchParams().get("id") ?? "";
  return <HabitDetail key={id} habitId={id} />;
}

function HabitDetail({ habitId }: { habitId: string }) {
  const router = useRouter();
  const { habits, loading } = useHabits();
  const [calMonthOffset, setCalMonthOffset] = React.useState(0);
  const [selectedKey, setSelectedKey] = React.useState(todayKey);
  const panelRef = React.useRef<HTMLDivElement>(null);

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

  const { value: streak, unit } = habitStreak(habit);
  const total = Object.values(habit.history).filter(Boolean).length;
  const isTime = habit.goalType === "time";
  const target = dayTarget(habit);
  const totalMinutes = isTime
    ? Math.round(
        Object.values(habit.counts).reduce((sum, s) => sum + Math.min(s, target), 0) / 60
      )
    : 0;
  const totalAmount =
    habit.goalType === "amount" ? Object.values(habit.counts).reduce((sum, n) => sum + n, 0) : 0;
  const unitWord = unit === "time" ? "in a row" : `${unit}s`;
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
              <Link href={editHabitHref(habit.id)} transitionTypes={nav("sheetUp")} />
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
          <p className="text-[13px] font-medium text-muted-foreground">
            {[
              goalLabel(habit),
              scheduleLabel(habit.schedule),
              habit.parts.length ? partsLabel(habit.parts) : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {habit.description && (
            <p className="line-clamp-2 text-[15px] text-muted-foreground">
              {habit.description}
            </p>
          )}
        </div>
      </section>

      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[1fr_22rem] lg:items-start lg:gap-6">
        <div className="flex flex-col gap-4">
          <div ref={panelRef} className="scroll-mt-20">
            <DayPanel
              habit={habit}
              dateKey={selectedKey}
              onBackToToday={() => setSelectedKey(todayKey())}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Stat
              label="Streak"
              value={streak}
              unit={unit === "time" ? "in a row" : streak === 1 ? unit : unitWord}
            />
            <Stat
              label="Goal"
              value={goal ?? "–"}
              unit={goal ? unitWord : "not set"}
              progress={goal ? goalProgress : undefined}
              colorHex={habit.colorHex}
            />
            {habit.goalType === "amount" ? (
              <Stat
                label="Total"
                value={totalAmount >= 10000 ? `${Math.round(totalAmount / 1000)}k` : withUnit(totalAmount, "")}
                unit={habit.amountUnit || "logged"}
              />
            ) : habit.goalType === "limit" ? (
              <Stat label="Kept" value={total} unit={total === 1 ? "day" : "days"} />
            ) : isTime ? (
              <Stat
                label="Total"
                value={totalMinutes >= 120 ? Math.round(totalMinutes / 6) / 10 : totalMinutes}
                unit={totalMinutes >= 120 ? "hours" : "min"}
              />
            ) : (
              <Stat label="Total" value={total} unit={total === 1 ? "day" : "days"} />
            )}
          </div>

          <Card>
            <CardContent className="flex flex-col gap-3">
              <SectionTitle>Last 6 months</SectionTitle>
              <Heatmap
                history={habit.history}
                colorHex={habit.colorHex}
                weeks={HEATMAP_WEEKS}
                schedule={habit.schedule}
                skipped={habit.skipped}
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
              skipped={habit.skipped}
              colorHex={habit.colorHex}
              monthOffset={calMonthOffset}
              onMonthOffsetChange={setCalMonthOffset}
              selectedKey={selectedKey}
              onSelectDay={(dateKey) => {
                setSelectedKey(dateKey);
                // On phones the panel sits above the calendar: bring it into view.
                if (window.matchMedia("(max-width: 1023px)").matches) {
                  panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                }
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
            style={{
              backgroundColor: colorHex ? habitTint(colorHex) : undefined,
              transform: `scaleX(${progress})`,
            }}
          />
        </span>
      )}
    </Card>
  );
}
