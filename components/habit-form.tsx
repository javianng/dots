"use client";

import { Check, Minus, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import { DeleteHabitButton } from "@/components/delete-habit-button";
import { Divider, Group, Row } from "@/components/grouped-list";
import { FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useAuth } from "@/hooks/use-auth";
import { haptic } from "@/lib/haptics";
import {
  DEFAULT_HABIT_ICON,
  HABIT_ICON_KEYS,
  HABIT_ICONS,
  resolveHabitIconKey,
} from "@/lib/habit-icons";
import { createHabit, updateHabit } from "@/lib/habits";
import {
  DEFAULT_HABIT_COLOR,
  HABIT_PALETTE,
  habitColorName,
  habitTint,
  habitTintAlpha,
} from "@/lib/palette";
import { nav } from "@/lib/transitions";
import type { Habit, HabitDraft, TrackingType } from "@/lib/types";
import { cn } from "@/lib/utils";

const bareInput =
  "h-12 rounded-none border-0 bg-transparent px-4 shadow-none focus-visible:ring-0 dark:bg-transparent";

/** New / Edit habit, presented as an iOS-style sheet with grouped sections. */
export function HabitForm({ habit }: { habit?: Habit }) {
  const router = useRouter();
  const { user } = useAuth();
  const isEdit = !!habit;
  const backHref = isEdit ? `/habits/${habit.id}` : "/";

  const [name, setName] = React.useState(habit?.name ?? "");
  const [description, setDescription] = React.useState(habit?.description ?? "");
  const [icon, setIcon] = React.useState(
    habit ? resolveHabitIconKey(habit.icon, habit.id) : DEFAULT_HABIT_ICON
  );
  const [colorHex, setColorHex] = React.useState(habit?.colorHex ?? DEFAULT_HABIT_COLOR);
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

  const canSave = name.trim().length > 0 && !pending;

  function dismiss(href = backHref) {
    router.push(href, { transitionTypes: nav("sheetDown") });
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!user || !canSave) return;
    setError(null);
    setPending(true);
    const goal = parseInt(streakGoal, 10);
    const draft: HabitDraft = {
      name: name.trim(),
      description: description.trim(),
      icon,
      colorHex,
      streakGoal: Number.isFinite(goal) && goal > 0 ? goal : null,
      completionsPerDay,
      trackingType,
    };
    try {
      if (isEdit) {
        await updateHabit(user.uid, habit.id, draft);
      } else {
        await createHabit(user.uid, draft);
      }
      haptic("success");
      dismiss(isEdit ? `/habits/${habit.id}` : "/");
    } catch {
      setError("Couldn't save. Try again.");
      setPending(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col px-4 pb-10">
      <form id="habit-form" onSubmit={handleSubmit} className="contents">
        <header className="material bar-edge pt-safe sticky top-0 z-20 -mx-4 px-2">
          <div className="grid h-14 grid-cols-[1fr_auto_1fr] items-center">
            <button
              type="button"
              onClick={() => dismiss()}
              className="tappable justify-self-start rounded-full px-3 py-2 text-[17px]"
            >
              Cancel
            </button>
            <h1 className="font-sans text-[17px] font-semibold">
              {isEdit ? "Edit Habit" : "New Habit"}
            </h1>
            <button
              type="submit"
              disabled={!canSave}
              className="tappable flex items-center gap-2 justify-self-end rounded-full px-3 py-2 text-[17px] font-semibold disabled:opacity-35"
            >
              {pending && <Spinner className="size-4" />}
              {isEdit ? "Done" : "Add"}
            </button>
          </div>
        </header>

        <div className="flex flex-col gap-7 pt-4">
          <Group>
            <label htmlFor="habit-name" className="sr-only">
              Name
            </label>
            <Input
              id="habit-name"
              placeholder="Name, e.g. Read 10 pages"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus={!isEdit}
              enterKeyHint="done"
              required
              className={bareInput}
            />
            <Divider />
            <label htmlFor="habit-description" className="sr-only">
              Description
            </label>
            <Textarea
              id="habit-description"
              placeholder="Description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className={cn(bareInput, "h-auto min-h-12 py-3")}
            />
          </Group>

          <Group label="Icon">
            <div className="grid grid-cols-7 gap-x-2 gap-y-3 p-4">
              {HABIT_ICON_KEYS.map((key) => {
                const Icon = HABIT_ICONS[key];
                const selected = icon === key;
                return (
                  <button
                    key={key}
                    type="button"
                    aria-label={`Icon ${key}`}
                    aria-pressed={selected}
                    onClick={() => {
                      haptic();
                      setIcon(key);
                    }}
                    className={cn(
                      "pressable flex aspect-square w-full items-center justify-center rounded-full text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                      selected && "ring-[2.5px] ring-offset-[3px] ring-offset-card"
                    )}
                    style={
                      selected
                        ? ({
                            backgroundColor: habitTintAlpha(colorHex, 16),
                            color: habitTint(colorHex),
                            "--tw-ring-color": habitTint(colorHex),
                          } as React.CSSProperties)
                        : undefined
                    }
                  >
                    <Icon className="size-5" />
                  </button>
                );
              })}
            </div>
          </Group>

          <Group label="Color">
            <div className="grid grid-cols-6 gap-x-3 gap-y-3 p-4">
              {HABIT_PALETTE.map((hex) => {
                const selected = colorHex === hex;
                return (
                  <button
                    key={hex}
                    type="button"
                    aria-label={habitColorName(hex)}
                    aria-pressed={selected}
                    onClick={() => {
                      haptic();
                      setColorHex(hex);
                    }}
                    className={cn(
                      "pressable flex aspect-square w-full items-center justify-center rounded-squircle text-(--on-tint) outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                      selected && "ring-[2.5px] ring-offset-[3px] ring-offset-card"
                    )}
                    style={
                      {
                        backgroundColor: habitTint(hex),
                        "--tw-ring-color": habitTint(hex),
                      } as React.CSSProperties
                    }
                  >
                    {selected && <Check className="size-4" strokeWidth={3} />}
                  </button>
                );
              })}
            </div>
          </Group>

          <Group label="Goal">
            <Row label="Streak goal" htmlFor="habit-streak-goal">
              <div className="flex items-center gap-1.5">
                <input
                  id="habit-streak-goal"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  placeholder="None"
                  value={streakGoal}
                  onChange={(e) => setStreakGoal(e.target.value)}
                  className="w-16 bg-transparent text-right text-[17px] text-muted-foreground tabular-nums outline-none placeholder:text-muted-foreground/60 focus:text-foreground"
                />
                <span className="text-[15px] text-muted-foreground">days</span>
              </div>
            </Row>
            <Divider />
            <Row label="Tracking">
              <ToggleGroup
                value={[trackingType]}
                onValueChange={(next: unknown[]) => {
                  const mode = next[0] as TrackingType | undefined;
                  if (mode) setTrackingType(mode);
                }}
                spacing={0}
                className="rounded-[9px] bg-foreground/[0.07] p-0.5"
              >
                {(["step", "custom"] as const).map((mode) => (
                  <ToggleGroupItem
                    key={mode}
                    value={mode}
                    className="h-8 rounded-[7px] px-3.5 text-[13px] font-medium transition-[background-color,box-shadow] duration-200 hover:bg-transparent aria-pressed:bg-card aria-pressed:shadow-[0_1px_3px_oklch(0_0_0/0.12)] dark:aria-pressed:bg-white/20"
                  >
                    {mode === "step" ? "Steps" : "Custom"}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </Row>
            <Divider />
            <Row label="Per day">
              <div className="flex items-center gap-3">
                <span className="w-6 text-right text-[17px] text-muted-foreground tabular-nums">
                  {completionsPerDay}
                </span>
                <div className="flex h-8 items-center rounded-[9px] bg-foreground/[0.07]">
                  <StepperButton
                    label="Decrease completions per day"
                    disabled={completionsPerDay <= 1}
                    onClick={() => setCompletionsPerDay((n) => Math.max(1, n - 1))}
                  >
                    <Minus />
                  </StepperButton>
                  <span className="h-4 w-px bg-foreground/15" />
                  <StepperButton
                    label="Increase completions per day"
                    onClick={() => setCompletionsPerDay((n) => n + 1)}
                  >
                    <Plus />
                  </StepperButton>
                </div>
              </div>
            </Row>
          </Group>

          {error && <FieldError className="px-4">{error}</FieldError>}

          {isEdit && <DeleteHabitButton habit={habit} disabled={pending} />}
        </div>
      </form>
    </main>
  );
}

function StepperButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={() => {
        haptic();
        onClick();
      }}
      className="tappable flex h-8 w-11 items-center justify-center disabled:opacity-30 [&_svg]:size-4"
    >
      {children}
    </button>
  );
}
