import { HabitForm } from "@/components/habit-form";
import { RequireAuth } from "@/components/require-auth";

export default function NewHabitPage() {
  return (
    <RequireAuth>
      <HabitForm />
    </RequireAuth>
  );
}
