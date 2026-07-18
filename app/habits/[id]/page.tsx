"use client";

import { HabitIcon } from "@/components/habit-icon";
import { HEATMAP_WEEKS, Heatmap } from "@/components/heatmap";
import { MonthCalendar } from "@/components/month-calendar";
import { RequireAuth } from "@/components/require-auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { useHabits } from "@/hooks/use-habits";
import { currentStreak } from "@/lib/dates";
import { setCompletion } from "@/lib/habits";
import { Pencil, X } from "lucide-react";
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
    <RequireAuth>
      <HabitDetail habitId={id} />
    </RequireAuth>
  );
}

function HabitDetail({ habitId }: { habitId: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const { habits, loading } = useHabits(user?.uid);
  const [calMonthOffset, setCalMonthOffset] = React.useState(0);

  const habit = habits?.find((h) => h.id === habitId);

  React.useEffect(() => {
    if (!loading && habits && !habit) router.replace("/");
  }, [loading, habits, habit, router]);

  if (loading || !habit) {
    return (
      <div className="mx-auto flex w-full max-w-xl flex-col gap-4 p-4 lg:max-w-4xl">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  const streak = currentStreak(habit.history);

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-5 px-4 py-4 lg:max-w-4xl">
      <div className="flex items-start gap-3">
        <HabitIcon habitId={habit.id} colorHex={habit.colorHex} className="size-12" />
        <div className="flex min-w-0 flex-1 flex-col">
          <h1 className="truncate text-lg font-semibold">{habit.name}</h1>
          <p className="truncate text-sm text-muted-foreground">
            {habit.description || "No description"}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon-lg"
          aria-label="Close"
          nativeButton={false}
          render={<Link href="/" />}
        >
          <X />
        </Button>
      </div>

      <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[1fr_20rem] lg:items-start lg:gap-10">
        <div className="flex flex-col gap-5">
          <Heatmap
            history={habit.history}
            colorHex={habit.colorHex}
            weeks={HEATMAP_WEEKS}
            showMonthLabels
            showWeekdayLabels
          />

          <div className="flex items-center gap-2">
            <Badge variant="secondary">
              {habit.streakGoal
                ? `Goal: ${habit.streakGoal} days`
                : "No goal set"}
            </Badge>
            <Badge variant="secondary">{streak} days</Badge>
            <span className="flex-1" />
            <Button
              variant="outline"
              size="icon-lg"
              aria-label="Edit habit"
              nativeButton={false}
              render={<Link href={`/habits/${habit.id}/edit`} />}
            >
              <Pencil />
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-5">
          <Separator className="lg:hidden" />

          <MonthCalendar
            history={habit.history}
            colorHex={habit.colorHex}
            monthOffset={calMonthOffset}
            onMonthOffsetChange={setCalMonthOffset}
            onToggleDay={(dateKey) => {
              if (!user) return;
              setCompletion(user.uid, habit.id, dateKey, !habit.history[dateKey]);
            }}
          />
        </div>
      </div>
    </main>
  );
}
