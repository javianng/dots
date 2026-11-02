"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { HabitForm } from "@/components/habit-form";
import { RequireAuth } from "@/components/require-auth";
import { Skeleton } from "@/components/ui/skeleton";
import { useHabits } from "@/hooks/use-habits";
import { PageTransition, nav } from "@/lib/transitions";

export default function EditHabitPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = React.use(params);
  return (
    <PageTransition>
      <RequireAuth>
        <EditHabit habitId={id} />
      </RequireAuth>
    </PageTransition>
  );
}

function EditHabit({ habitId }: { habitId: string }) {
  const router = useRouter();
  const { habits, loading } = useHabits();
  const habit = habits?.find((h) => h.id === habitId);

  // Hold on to the last habit so that deleting it keeps the form on screen
  // while the sheet slides away, instead of flashing the skeleton.
  const [shownHabit, setShownHabit] = React.useState(habit);
  if (habit && habit !== shownHabit) setShownHabit(habit);

  React.useEffect(() => {
    if (!loading && habits && !habit) {
      router.replace("/", { transitionTypes: nav("sheetDown") });
    }
  }, [loading, habits, habit, router]);

  if (!shownHabit) {
    return (
      <div className="mx-auto flex w-full max-w-xl flex-col gap-4 p-4">
        <Skeleton className="h-10 w-full rounded-xl" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    );
  }

  return <HabitForm habit={shownHabit} />;
}
