import { HabitForm } from "@/components/habit-form";
import { RequireAuth } from "@/components/require-auth";
import { PageTransition } from "@/lib/transitions";

export default function NewHabitPage() {
  return (
    <PageTransition>
      <RequireAuth>
        <HabitForm />
      </RequireAuth>
    </PageTransition>
  );
}
