"use client";

import { Check, Minus, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useAuth } from "@/hooks/use-auth";
import { createHabit, updateHabit } from "@/lib/habits";
import { DEFAULT_HABIT_COLOR, HABIT_PALETTE } from "@/lib/palette";
import type { Habit, HabitDraft, TrackingType } from "@/lib/types";
import { cn } from "@/lib/utils";

export function HabitForm({ habit }: { habit?: Habit }) {
  const router = useRouter();
  const { user } = useAuth();
  const isEdit = !!habit;
  const backHref = isEdit ? `/habits/${habit.id}` : "/";

  const [name, setName] = React.useState(habit?.name ?? "");
  const [description, setDescription] = React.useState(habit?.description ?? "");
  const [colorHex, setColorHex] = React.useState(
    habit?.colorHex ?? DEFAULT_HABIT_COLOR
  );
  const [streakGoal, setStreakGoal] = React.useState(
    habit?.streakGoal ? String(habit.streakGoal) : ""
  );
  const [trackingType, setTrackingType] = React.useState<TrackingType>(
    habit?.trackingType ?? "step"
  );
  const [completionsPerDay, setCompletionsPerDay] = React.useState(
    habit?.completionsPerDay ?? 1
  );
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!user) return;
    setError(null);
    setPending(true);
    const goal = parseInt(streakGoal, 10);
    const draft: HabitDraft = {
      name: name.trim(),
      description: description.trim(),
      colorHex,
      streakGoal: Number.isFinite(goal) && goal > 0 ? goal : null,
      completionsPerDay,
      trackingType,
    };
    try {
      if (isEdit) {
        await updateHabit(user.uid, habit.id, draft);
        router.push(`/habits/${habit.id}`);
      } else {
        await createHabit(user.uid, draft);
        router.push("/");
      }
    } catch {
      setError("Could not save the habit. Please try again.");
      setPending(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 px-4 py-4">
      <div className="grid grid-cols-[2.5rem_1fr_2.5rem] items-center">
        <Button
          variant="ghost"
          size="icon-lg"
          aria-label="Back"
          onClick={() => router.push(backHref)}
        >
          <X />
        </Button>
        <h1 className="text-center text-lg font-semibold">
          {isEdit ? "Edit Habit" : "New Habit"}
        </h1>
      </div>

      <form onSubmit={handleSubmit}>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="habit-name">Name</FieldLabel>
            <Input
              id="habit-name"
              placeholder="e.g. Read 10 pages"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="habit-description">Description</FieldLabel>
            <Textarea
              id="habit-description"
              placeholder="Optional"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </Field>

          <Field>
            <FieldLabel>Color</FieldLabel>
            <div className="grid grid-cols-7 gap-2">
              {HABIT_PALETTE.map((hex) => (
                <button
                  key={hex}
                  type="button"
                  aria-label={`Color ${hex}`}
                  aria-pressed={colorHex === hex}
                  onClick={() => setColorHex(hex)}
                  className={cn(
                    "flex aspect-square w-full items-center justify-center rounded-lg text-white transition-transform outline-none hover:scale-105 focus-visible:ring-2 focus-visible:ring-ring/50",
                    colorHex === hex && "ring-2 ring-foreground ring-offset-2 ring-offset-background"
                  )}
                  style={{ backgroundColor: hex }}
                >
                  {colorHex === hex && <Check className="size-4" />}
                </button>
              ))}
            </div>
          </Field>

          <Field>
            <FieldLabel htmlFor="habit-streak-goal">Streak Goal</FieldLabel>
            <Input
              id="habit-streak-goal"
              type="number"
              min={1}
              placeholder="None"
              value={streakGoal}
              onChange={(e) => setStreakGoal(e.target.value)}
            />
          </Field>

          <Field>
            <FieldLabel>Tracking</FieldLabel>
            <ToggleGroup
              value={[trackingType]}
              onValueChange={(next: unknown[]) => {
                const mode = next[0] as TrackingType | undefined;
                if (mode) setTrackingType(mode);
              }}
              variant="outline"
              spacing={0}
              className="w-full"
            >
              <ToggleGroupItem value="step" className="flex-1">
                Step By Step
              </ToggleGroupItem>
              <ToggleGroupItem value="custom" className="flex-1">
                Custom Value
              </ToggleGroupItem>
            </ToggleGroup>
          </Field>

          <Field>
            <FieldLabel>Completions Per Day</FieldLabel>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="icon-lg"
                aria-label="Decrease completions per day"
                disabled={completionsPerDay <= 1}
                onClick={() => setCompletionsPerDay((n) => Math.max(1, n - 1))}
              >
                <Minus />
              </Button>
              <span className="w-8 text-center text-sm font-medium">
                {completionsPerDay}
              </span>
              <Button
                type="button"
                variant="outline"
                size="icon-lg"
                aria-label="Increase completions per day"
                onClick={() => setCompletionsPerDay((n) => n + 1)}
              >
                <Plus />
              </Button>
            </div>
          </Field>

          {error && <FieldError>{error}</FieldError>}

          <Button type="submit" size="lg" className="w-full" disabled={pending}>
            {pending && <Spinner data-icon="inline-start" />}
            Save
          </Button>
        </FieldGroup>
      </form>
    </main>
  );
}
