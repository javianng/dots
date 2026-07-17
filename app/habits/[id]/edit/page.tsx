"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { HabitForm } from "@/components/habit-form";
import { RequireAuth } from "@/components/require-auth";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { useHabits } from "@/hooks/use-habits";

export default function EditHabitPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = React.use(params);
  return (
    <RequireAuth>
      <EditHabit habitId={id} />
    </RequireAuth>
  );
}

function EditHabit({ habitId }: { habitId: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const { habits, loading } = useHabits(user?.uid);
  const habit = habits?.find((h) => h.id === habitId);

  React.useEffect(() => {
    if (!loading && habits && !habit) router.replace("/");
  }, [loading, habits, habit, router]);

  if (loading || !habit) {
    return (
      <div className="mx-auto flex w-full max-w-xl flex-col gap-4 p-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return <HabitForm habit={habit} />;
}
