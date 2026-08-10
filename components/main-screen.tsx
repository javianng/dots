"use client";

import { AppHeader } from "@/components/app-header";
import { DayToggle } from "@/components/day-toggle";
import { HabitIcon } from "@/components/habit-icon";
import { HEATMAP_WEEKS, Heatmap } from "@/components/heatmap";
import { Card, CardContent } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { ViewSwitcher, type ViewTab } from "@/components/view-switcher";
import { useAuth } from "@/hooks/use-auth";
import { useHabits } from "@/hooks/use-habits";
import { currentStreak, lastNDays, toDateKey, todayKey } from "@/lib/dates";
import { setCompletion } from "@/lib/habits";
import type { Habit } from "@/lib/types";
import { cn } from "@/lib/utils";
import Link from "next/link";
import * as React from "react";

export function MainScreen() {
  const { user } = useAuth();
  const { habits, loading } = useHabits(user?.uid);
  const [activeTab, setActiveTab] = React.useState<ViewTab>("grid");

  const toggle = React.useCallback(
    (habit: Habit, dateKey: string) => {
      if (!user) return;
      setCompletion(user.uid, habit.id, dateKey, !habit.history[dateKey]);
    },
    [user]
  );

  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col px-4 pb-24 md:max-w-3xl xl:max-w-6xl">
      <AppHeader />
      {loading ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          <Skeleton className="h-36 w-full" />
          <Skeleton className="h-36 w-full" />
          <Skeleton className="h-36 w-full" />
        </div>
      ) : habits && habits.length === 0 ? (
        <Empty className="flex-1">
          <EmptyHeader>
            <EmptyTitle>Nothing here yet</EmptyTitle>
            <EmptyDescription>
              Tap + to begin.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : activeTab === "grid" ? (
        <GridView habits={habits ?? []} onToggle={toggle} />
      ) : activeTab === "list" ? (
        <ListView habits={habits ?? []} onToggle={toggle} />
      ) : (
        <CompactView habits={habits ?? []} onToggle={toggle} />
      )}
      <ViewSwitcher value={activeTab} onChange={setActiveTab} />
    </div>
  );
}

function GridView({
  habits,
  onToggle,
}: {
  habits: Habit[];
  onToggle: (habit: Habit, dateKey: string) => void;
}) {
  const today = todayKey();
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
      {habits.map((habit) => (
        <Card key={habit.id} className="py-4">
          <CardContent className="flex flex-col gap-3 px-4">
            <div className="flex items-center gap-3">
              <Link
                href={`/habits/${habit.id}`}
                className="flex min-w-0 flex-1 items-center gap-3"
              >
                <HabitIcon habitId={habit.id} icon={habit.icon} colorHex={habit.colorHex} />
                <span className="truncate font-medium">{habit.name}</span>
              </Link>
              <DayToggle
                completed={!!habit.history[today]}
                colorHex={habit.colorHex}
                onToggle={() => onToggle(habit, today)}
                label={`Mark ${habit.name} done today`}
              />
            </div>
            <Heatmap
              history={habit.history}
              colorHex={habit.colorHex}
              weeks={HEATMAP_WEEKS}
            />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ListView({
  habits,
  onToggle,
}: {
  habits: Habit[];
  onToggle: (habit: Habit, dateKey: string) => void;
}) {
  const days = lastNDays(5);
  const today = todayKey();
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-2">
      <div className="flex items-center gap-2 px-1 pb-1">
        <span className="min-w-0 flex-1 text-xs text-muted-foreground">
          Last 5 days
        </span>
        {days.map((day) => {
          const key = toDateKey(day);
          const isToday = key === today;
          return (
            <span
              key={key}
              className={cn(
                "flex w-9 flex-col items-center text-[10px] leading-tight",
                isToday
                  ? "font-bold text-foreground"
                  : "text-muted-foreground"
              )}
            >
              <span>
                {day.toLocaleDateString(undefined, { weekday: "short" })}
              </span>
              <span>{day.getDate()}</span>
            </span>
          );
        })}
      </div>
      {habits.map((habit) => (
        <Card key={habit.id} className="py-3">
          <CardContent className="flex items-center gap-2 px-3">
            <Link
              href={`/habits/${habit.id}`}
              className="flex min-w-0 flex-1 items-center gap-3"
            >
              <HabitIcon habitId={habit.id} icon={habit.icon} colorHex={habit.colorHex} />
              <span className="truncate text-sm font-medium">{habit.name}</span>
            </Link>
            {days.map((day) => {
              const key = toDateKey(day);
              return (
                <DayToggle
                  key={key}
                  completed={!!habit.history[key]}
                  colorHex={habit.colorHex}
                  onToggle={() => onToggle(habit, key)}
                  label={`Mark ${habit.name} done on ${key}`}
                  className="w-9"
                />
              );
            })}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function CompactView({
  habits,
  onToggle,
}: {
  habits: Habit[];
  onToggle: (habit: Habit, dateKey: string) => void;
}) {
  const today = todayKey();
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-2">
      {habits.map((habit) => {
        const streak = currentStreak(habit.history);
        return (
          <Card key={habit.id} className="py-3">
            <CardContent className="flex items-center gap-3 px-3">
              <Link href={`/habits/${habit.id}`} aria-label={`${habit.name} details`}>
                <HabitIcon habitId={habit.id} icon={habit.icon} colorHex={habit.colorHex} />
              </Link>
              <Link
                href={`/habits/${habit.id}`}
                className="flex min-w-0 flex-1 flex-col"
              >
                <span className="truncate text-sm font-medium">{habit.name}</span>
                <span className="text-xs text-muted-foreground">
                  {streak > 0 ? `${streak} days` : "Not started"}
                </span>
              </Link>
              <DayToggle
                completed={!!habit.history[today]}
                colorHex={habit.colorHex}
                onToggle={() => onToggle(habit, today)}
                label={`Mark ${habit.name} done today`}
              />
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
