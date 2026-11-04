"use client";

import { Check, Minus, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import { DeleteHabitButton } from "@/components/delete-habit-button";
import { Divider, Group, Row } from "@/components/grouped-list";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { haptic } from "@/lib/haptics";
import {
  DEFAULT_HABIT_ICON,
  HABIT_ICON_KEYS,
  HABIT_ICONS,
  resolveHabitIconKey,
} from "@/lib/habit-icons";
import { formatMinutes } from "@/lib/check-in";
import { clearTimer, createHabit, rescaleCompletions, updateHabit } from "@/lib/habits";
import {
  DEFAULT_HABIT_COLOR,
  HABIT_PALETTE,
  habitColorName,
  habitTint,
  habitTintAlpha,
} from "@/lib/palette";
import { habitHref } from "@/lib/routes";
import { DAILY, MAX_TIMES, dayTarget, WEEKDAYS, scheduleLabel, streakUnit } from "@/lib/schedule";
import { nav } from "@/lib/transitions";
import type { GoalType, Habit, HabitDraft, Schedule } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Keeps the ring readable and the stepper sane. */
const MAX_DAILY_TARGET = 20;

/** Stops the minutes stepper walks through (fine-grained when short). */
const DURATION_STEPS = [1, 2, 3, 5, 10, 15, 20, 25, 30, 40, 45, 60, 75, 90, 120, 150, 180, 240];

type RepeatKind = "daily" | "days" | "week" | "month";

function repeatKind(schedule: Schedule): RepeatKind {
  return schedule.type === "period" ? schedule.period : schedule.type;
}

const bareInput =
  "h-12 rounded-none border-0 bg-transparent px-4 shadow-none focus-visible:ring-0 dark:bg-transparent";

/** New / Edit habit, presented as an iOS-style sheet with grouped sections. */
export function HabitForm({ habit }: { habit?: Habit }) {
  const router = useRouter();
  const { user } = useAuth();
  const isEdit = !!habit;
  const backHref = isEdit ? habitHref(habit.id) : "/";

  const [name, setName] = React.useState(habit?.name ?? "");
  const [description, setDescription] = React.useState(habit?.description ?? "");
  const [icon, setIcon] = React.useState(
    habit ? resolveHabitIconKey(habit.icon, habit.id) : DEFAULT_HABIT_ICON
  );
  const [colorHex, setColorHex] = React.useState(habit?.colorHex ?? DEFAULT_HABIT_COLOR);
  const [streakGoal, setStreakGoal] = React.useState(
    habit?.streakGoal ? String(habit.streakGoal) : ""
  );
  const [completionsPerDay, setCompletionsPerDay] = React.useState(
    habit?.completionsPerDay ?? 1
  );
  const [goalType, setGoalType] = React.useState<GoalType>(habit?.goalType ?? "count");
  const [durationMinutes, setDurationMinutes] = React.useState(habit?.durationMinutes ?? 15);
  const initialSchedule = habit?.schedule ?? DAILY;
  const [repeat, setRepeat] = React.useState<RepeatKind>(repeatKind(initialSchedule));
  const [days, setDays] = React.useState<number[]>(
    initialSchedule.type === "days" ? initialSchedule.days : [1, 3, 5]
  );
  const [times, setTimes] = React.useState(
    initialSchedule.type === "period" ? initialSchedule.times : 3
  );
  const [pending, setPending] = React.useState(false);

  const schedule: Schedule =
    repeat === "daily"
      ? DAILY
      : repeat === "days"
        ? days.length === 0 || days.length === 7
          ? DAILY
          : { type: "days", days: [...days].sort() }
        : { type: "period", period: repeat, times: Math.min(times, MAX_TIMES[repeat]) };
  const unit = streakUnit(schedule);

  const canSave = name.trim().length > 0 && !pending && !(repeat === "days" && days.length === 0);

  function dismiss(href = backHref) {
    router.push(href, { transitionTypes: nav("sheetDown") });
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!user || !canSave) return;
    setPending(true);
    const goal = parseInt(streakGoal, 10);
    const draft: HabitDraft = {
      name: name.trim(),
      description: description.trim(),
      icon,
      colorHex,
      streakGoal: Number.isFinite(goal) && goal > 0 ? goal : null,
      goalType,
      completionsPerDay,
      durationMinutes,
      schedule,
    };
    // Don't wait for the server: Firestore applies the change locally right
    // away (and queues it while offline), so the sheet can close now. A
    // rejected write (e.g. rules) surfaces as a toast instead.
    const write = isEdit
      ? updateHabit(user.uid, habit.id, draft)
      : createHabit(user.uid, draft);
    write.catch(() => toast.error(`Couldn't save "${draft.name}". Try again.`));
    if (isEdit && habit.goalType !== draft.goalType) {
      // Taps and seconds don't convert: keep finished days finished.
      rescaleCompletions(user.uid, habit.id, habit.history, dayTarget(draft)).catch(() => {});
      if (habit.timer) clearTimer(user.uid, habit.id).catch(() => {});
    }
    haptic("success");
    dismiss(isEdit ? habitHref(habit.id) : "/");
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

          <Group
            label="Goal"
            footer={
              goalType === "time"
                ? `Tap play to count down ${formatMinutes(durationMinutes)}. Pause any time; the day is done when the timer runs out.`
                : completionsPerDay === 1
                  ? "One tap marks the day done."
                  : `Tap ${completionsPerDay} times to finish the day. Each tap fills part of the ring.`
            }
          >
            <div className="p-2">
              <Segmented
                label="Goal type"
                value={goalType}
                onChange={setGoalType}
                options={[
                  { value: "count", label: "Check-ins" },
                  { value: "time", label: "Timer" },
                ]}
              />
            </div>
            <Divider />
            {goalType === "count" ? (
              <Row label="Daily target">
                <Stepper
                  value={`${completionsPerDay}× a day`}
                  decLabel="Decrease daily target"
                  incLabel="Increase daily target"
                  canDec={completionsPerDay > 1}
                  canInc={completionsPerDay < MAX_DAILY_TARGET}
                  onDec={() => setCompletionsPerDay((n) => Math.max(1, n - 1))}
                  onInc={() => setCompletionsPerDay((n) => Math.min(MAX_DAILY_TARGET, n + 1))}
                />
              </Row>
            ) : (
              <Row label="Duration">
                <Stepper
                  value={formatMinutes(durationMinutes)}
                  decLabel="Shorter"
                  incLabel="Longer"
                  canDec={durationMinutes > DURATION_STEPS[0]}
                  canInc={durationMinutes < DURATION_STEPS[DURATION_STEPS.length - 1]}
                  onDec={() =>
                    setDurationMinutes(
                      (m) => [...DURATION_STEPS].reverse().find((s) => s < m) ?? m
                    )
                  }
                  onInc={() => setDurationMinutes((m) => DURATION_STEPS.find((s) => s > m) ?? m)}
                />
              </Row>
            )}
          </Group>

          <Group label="Repeat" footer={repeatFooter(schedule, repeat, days)}>
            <div className="p-2">
              <Segmented
                label="Repeat"
                value={repeat}
                onChange={setRepeat}
                options={[
                  { value: "daily", label: "Daily" },
                  { value: "days", label: "Days" },
                  { value: "week", label: "Weekly" },
                  { value: "month", label: "Monthly" },
                ]}
              />
            </div>
            {repeat === "days" && (
              <>
                <Divider />
                <div className="flex justify-between gap-1.5 px-4 py-3" role="group" aria-label="Days of the week">
                  {WEEKDAYS.map((d) => {
                    const on = days.includes(d.value);
                    return (
                      <button
                        key={d.value}
                        type="button"
                        aria-label={d.long}
                        aria-pressed={on}
                        onClick={() => {
                          haptic();
                          setDays((prev) =>
                            on ? prev.filter((x) => x !== d.value) : [...prev, d.value]
                          );
                        }}
                        className={cn(
                          "pressable flex size-10 items-center justify-center rounded-full text-[15px] font-semibold",
                          !on && "bg-foreground/[0.07] text-muted-foreground"
                        )}
                        style={
                          on
                            ? { backgroundColor: habitTint(colorHex), color: "var(--on-tint)" }
                            : undefined
                        }
                      >
                        {d.short}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
            {(repeat === "week" || repeat === "month") && (
              <>
                <Divider />
                <Row label="How often">
                  <Stepper
                    value={`${times}× a ${repeat}`}
                    decLabel="Fewer times"
                    incLabel="More times"
                    canDec={times > 1}
                    canInc={times < MAX_TIMES[repeat]}
                    onDec={() => setTimes((n) => Math.max(1, n - 1))}
                    onInc={() => setTimes((n) => Math.min(MAX_TIMES[repeat], n + 1))}
                  />
                </Row>
              </>
            )}
            <Divider />
            <Row label="Streak goal" htmlFor="habit-streak-goal">
              <div className="flex items-center gap-1.5">
                <input
                  id="habit-streak-goal"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  placeholder="Off"
                  value={streakGoal}
                  onChange={(e) => setStreakGoal(e.target.value)}
                  className="w-16 bg-transparent text-right text-[17px] text-muted-foreground tabular-nums outline-none placeholder:text-muted-foreground/60 focus:text-foreground"
                />
                {streakGoal.trim() !== "" && (
                  <span className="text-[15px] text-muted-foreground">{unit}s</span>
                )}
              </div>
            </Row>
          </Group>

          {isEdit && <DeleteHabitButton habit={habit} disabled={pending} />}
        </div>
      </form>
    </main>
  );
}

function repeatFooter(schedule: Schedule, repeat: RepeatKind, days: number[]) {
  if (repeat === "days" && days.length === 0) return "Pick at least one day.";
  if (schedule.type === "daily") return "Every day. Streaks count days in a row.";
  if (schedule.type === "days")
    return `${scheduleLabel(schedule)}. Other days are rest days: they don't break your streak.`;
  return `Any ${schedule.times} ${schedule.times === 1 ? "day" : "days"} each ${schedule.period}${
    schedule.period === "week" ? " (Mon–Sun)" : ""
  }. Streaks count ${schedule.period}s that hit the target.`;
}

/** iOS segmented control. */
function Segmented<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-[9px] bg-foreground/[0.07] p-0.5">
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => {
              if (selected) return;
              haptic();
              onChange(o.value);
            }}
            className={cn(
              "flex-1 rounded-[7px] py-1.5 text-[13px] font-medium transition-[background-color,box-shadow] duration-200 ease-(--ease-ios)",
              selected ? "bg-card shadow-sm" : "text-muted-foreground"
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Stepper({
  value,
  decLabel,
  incLabel,
  canDec,
  canInc,
  onDec,
  onInc,
}: {
  value: string;
  decLabel: string;
  incLabel: string;
  canDec: boolean;
  canInc: boolean;
  onDec: () => void;
  onInc: () => void;
}) {
  return (
    <div className="flex h-8 items-center rounded-[9px] bg-foreground/[0.07]">
      <StepperButton label={decLabel} disabled={!canDec} onClick={onDec}>
        <Minus />
      </StepperButton>
      <span
        aria-live="polite"
        className="min-w-20 px-1 text-center text-[15px] font-medium whitespace-nowrap tabular-nums"
      >
        {value}
      </span>
      <StepperButton label={incLabel} disabled={!canInc} onClick={onInc}>
        <Plus />
      </StepperButton>
    </div>
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
