"use client";

import { Check, ChevronDown, Minus, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import { DeleteHabitButton } from "@/components/delete-habit-button";
import { Divider, Group, Row } from "@/components/grouped-list";
import { HabitIcon } from "@/components/habit-icon";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { formatMinutes } from "@/lib/check-in";
import { haptic } from "@/lib/haptics";
import { DEFAULT_HABIT_ICON, HABIT_ICON_KEYS, HABIT_ICONS, resolveHabitIconKey } from "@/lib/habit-icons";
import { clearTimer, createHabit, rescaleCompletions, updateHabit } from "@/lib/habits";
import {
  DEFAULT_HABIT_COLOR,
  HABIT_PALETTE,
  habitColorName,
  habitTint,
  habitTintAlpha,
} from "@/lib/palette";
import { habitHref } from "@/lib/routes";
import {
  DAILY,
  DAY_PARTS,
  MAX_INTERVAL,
  MAX_TIMES,
  WEEKDAYS,
  dayTarget,
  goalLabel,
  partsLabel,
  scheduleLabel,
  streakUnit,
  withUnit,
} from "@/lib/schedule";
import { HABIT_TEMPLATES } from "@/lib/templates";
import { nav } from "@/lib/transitions";
import type { DayPart, GoalType, Habit, HabitDraft, Schedule } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Keeps the ring readable and the stepper sane. */
const MAX_DAILY_TARGET = 20;

/** Stops the minutes stepper walks through (fine-grained when short). */
const DURATION_STEPS = [1, 2, 3, 5, 10, 15, 20, 25, 30, 40, 45, 60, 75, 90, 120, 150, 180, 240];

type RepeatKind = "daily" | "days" | "week" | "month" | "interval";

function repeatKind(schedule: Schedule): RepeatKind {
  return schedule.type === "period" ? schedule.period : schedule.type;
}

const bareInput =
  "h-12 rounded-none border-0 bg-transparent px-4 shadow-none focus-visible:ring-0 dark:bg-transparent";

const inlineInput =
  "rounded-lg bg-foreground/[0.07] px-2.5 py-1 text-right text-[17px] tabular-nums outline-none placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-ring/50";

/** Everything the form edits, as UI state (numbers kept as typed strings). */
interface FormState {
  name: string;
  description: string;
  icon: string;
  colorHex: string;
  streakGoal: string;
  goalType: GoalType;
  completionsPerDay: number;
  durationMinutes: number;
  amountTarget: string;
  amountUnit: string;
  amountStep: string;
  repeat: RepeatKind;
  days: number[];
  times: number;
  every: number;
  parts: DayPart[];
}

function toFormState(d: Omit<HabitDraft, "icon"> & { icon: string }): FormState {
  return {
    name: d.name,
    description: d.description,
    icon: d.icon,
    colorHex: d.colorHex,
    streakGoal: d.streakGoal ? String(d.streakGoal) : "",
    goalType: d.goalType,
    completionsPerDay: d.completionsPerDay,
    durationMinutes: d.durationMinutes,
    amountTarget: String(d.amountTarget),
    amountUnit: d.amountUnit,
    amountStep: String(d.amountStep),
    repeat: repeatKind(d.schedule),
    days: d.schedule.type === "days" ? d.schedule.days : [1, 3, 5],
    times: d.schedule.type === "period" ? d.schedule.times : 3,
    every: d.schedule.type === "interval" ? d.schedule.every : 3,
    parts: d.parts,
  };
}

const EMPTY = toFormState({
  name: "",
  description: "",
  icon: DEFAULT_HABIT_ICON,
  colorHex: DEFAULT_HABIT_COLOR,
  streakGoal: null,
  goalType: "count",
  completionsPerDay: 1,
  durationMinutes: 15,
  amountTarget: 1,
  amountUnit: "",
  amountStep: 1,
  schedule: DAILY,
  parts: [],
});

function scheduleFrom(f: FormState): Schedule {
  switch (f.repeat) {
    case "days":
      return f.days.length === 0 || f.days.length === 7 ? DAILY : { type: "days", days: [...f.days].sort() };
    case "week":
    case "month":
      return { type: "period", period: f.repeat, times: Math.min(f.times, MAX_TIMES[f.repeat]) };
    case "interval":
      return { type: "interval", every: f.every };
    default:
      return DAILY;
  }
}

function toDraft(f: FormState): HabitDraft {
  const goal = parseInt(f.streakGoal, 10);
  const amountTarget = Number(f.amountTarget);
  const amountStep = Number(f.amountStep);
  const multiSlot = f.goalType === "count" && f.parts.length > 1;
  return {
    name: f.name.trim(),
    description: f.description.trim(),
    icon: f.icon,
    colorHex: f.colorHex,
    streakGoal: Number.isFinite(goal) && goal > 0 ? goal : null,
    goalType: f.goalType,
    // One check per time of day when several are picked.
    completionsPerDay: multiSlot ? f.parts.length : f.completionsPerDay,
    durationMinutes: f.durationMinutes,
    amountTarget: Number.isFinite(amountTarget) ? Math.max(0, amountTarget) : 1,
    amountUnit: f.amountUnit.trim(),
    amountStep: Number.isFinite(amountStep) && amountStep > 0 ? amountStep : 1,
    schedule: scheduleFrom(f),
    parts: f.goalType === "count" ? f.parts : f.parts.slice(0, 1),
  };
}

/** Why the form can't be saved yet, if anything. */
function problem(f: FormState): string | null {
  if (!f.name.trim()) return "Give it a name.";
  if (f.repeat === "days" && f.days.length === 0) return "Pick at least one day.";
  const target = Number(f.amountTarget);
  const step = Number(f.amountStep);
  if (f.goalType === "amount" && !(target > 0)) return "Set a daily target above 0.";
  if (f.goalType === "limit" && !(target >= 0 && f.amountTarget.trim() !== "")) return "Set a limit (0 or more).";
  if ((f.goalType === "amount" || f.goalType === "limit") && !(step > 0)) return "Each tap needs to add more than 0.";
  return null;
}

/**
 * New / Edit habit, presented as an iOS-style sheet.
 *
 * New habits start simple: a name field and templates. The rest of the form
 * appears once there's a name, so the first screen never feels like a
 * settings page. Icon and colour fold into one Appearance row.
 */
export function HabitForm({ habit }: { habit?: Habit }) {
  const router = useRouter();
  const { user } = useAuth();
  const isEdit = !!habit;
  const backHref = isEdit ? habitHref(habit.id) : "/";

  const [f, setF] = React.useState<FormState>(() =>
    habit ? toFormState({ ...habit, icon: resolveHabitIconKey(habit.icon, habit.id) }) : EMPTY
  );
  const [pending, setPending] = React.useState(false);
  const [appearanceOpen, setAppearanceOpen] = React.useState(false);
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setF((prev) => ({ ...prev, [key]: value }));

  const issue = problem(f);
  const canSave = !issue && !pending;
  const started = isEdit || f.name.trim().length > 0;
  const draft = toDraft(f);
  const unit = streakUnit(draft.schedule);

  function dismiss(href = backHref) {
    router.push(href, { transitionTypes: nav("sheetDown") });
  }

  function pickTemplate(id: string) {
    const t = HABIT_TEMPLATES.find((x) => x.id === id);
    if (!t) return;
    haptic();
    setF(toFormState(t.draft));
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!user || !canSave) return;
    setPending(true);
    // Don't wait for the server: Firestore applies the change locally right
    // away (and queues it while offline), so the sheet can close now. A
    // rejected write (e.g. rules) surfaces as a toast instead.
    const write = isEdit ? updateHabit(user.uid, habit.id, draft) : createHabit(user.uid, draft);
    write.catch(() => toast.error(`Couldn't save "${draft.name}". Try again.`));
    if (isEdit && habit.goalType !== draft.goalType) {
      // Taps, seconds and units don't convert: keep finished days finished
      // (except to or from a limit, which means something else entirely).
      const fromLimit = habit.goalType === "limit";
      const days = fromLimit
        ? Object.fromEntries(Object.keys(habit.counts).map((k) => [k, false]))
        : habit.history;
      const keep = !fromLimit && draft.goalType !== "limit";
      rescaleCompletions(user.uid, habit.id, days, dayTarget(draft), keep).catch(() => {});
      if (habit.timer) clearTimer(user.uid, habit.id).catch(() => {});
    }
    haptic("success");
    dismiss(isEdit ? habitHref(habit.id) : "/");
  }

  function togglePart(part: DayPart) {
    haptic();
    setF((prev) => {
      const on = prev.parts.includes(part);
      // Only check-off habits can repeat through the day; others pick one time.
      if (prev.goalType !== "count") return { ...prev, parts: on ? [] : [part] };
      const parts = on ? prev.parts.filter((p) => p !== part) : [...prev.parts, part];
      return { ...prev, parts: DAY_PARTS.map((p) => p.value).filter((p) => parts.includes(p)) };
    });
  }

  function changeGoalType(goalType: GoalType) {
    setF((prev) => ({
      ...prev,
      goalType,
      parts: goalType === "count" ? prev.parts : prev.parts.slice(0, 1),
      // Sensible starting points so the row never opens empty.
      amountTarget:
        goalType === "limit" && prev.goalType !== "limit"
          ? "2"
          : goalType === "amount" && prev.goalType !== "amount"
            ? "10"
            : prev.amountTarget,
    }));
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
              value={f.name}
              onChange={(e) => set("name", e.target.value)}
              autoFocus={!isEdit}
              enterKeyHint="done"
              autoComplete="off"
              required
              className={bareInput}
            />
            {started && (
              <>
                <Divider />
                <label htmlFor="habit-description" className="sr-only">
                  Description
                </label>
                <Textarea
                  id="habit-description"
                  placeholder="Note (optional)"
                  value={f.description}
                  onChange={(e) => set("description", e.target.value)}
                  rows={1}
                  className={cn(bareInput, "h-auto min-h-12 py-3")}
                />
              </>
            )}
          </Group>

          {!started && <TemplatePicker onPick={pickTemplate} />}

          {started && (
            <>
              <Group label="Goal" footer={goalFooter(draft)}>
                <div className="p-2">
                  <Segmented
                    label="Goal type"
                    value={f.goalType}
                    onChange={changeGoalType}
                    options={[
                      { value: "count", label: "Check off" },
                      { value: "amount", label: "Amount" },
                      { value: "time", label: "Timer" },
                      { value: "limit", label: "Limit" },
                    ]}
                  />
                </div>
                <Divider />
                {f.goalType === "count" &&
                  (f.parts.length > 1 ? (
                    <Row label="Each day">
                      <span className="text-[17px] text-muted-foreground">Once each time</span>
                    </Row>
                  ) : (
                    <Row label="Each day">
                      <Stepper
                        value={`${f.completionsPerDay}×`}
                        decLabel="Fewer times a day"
                        incLabel="More times a day"
                        canDec={f.completionsPerDay > 1}
                        canInc={f.completionsPerDay < MAX_DAILY_TARGET}
                        onDec={() => set("completionsPerDay", Math.max(1, f.completionsPerDay - 1))}
                        onInc={() =>
                          set("completionsPerDay", Math.min(MAX_DAILY_TARGET, f.completionsPerDay + 1))
                        }
                      />
                    </Row>
                  ))}
                {f.goalType === "time" && (
                  <Row label="Duration">
                    <Stepper
                      value={formatMinutes(f.durationMinutes)}
                      decLabel="Shorter"
                      incLabel="Longer"
                      canDec={f.durationMinutes > DURATION_STEPS[0]}
                      canInc={f.durationMinutes < DURATION_STEPS[DURATION_STEPS.length - 1]}
                      onDec={() =>
                        set(
                          "durationMinutes",
                          [...DURATION_STEPS].reverse().find((s) => s < f.durationMinutes) ?? f.durationMinutes
                        )
                      }
                      onInc={() =>
                        set(
                          "durationMinutes",
                          DURATION_STEPS.find((s) => s > f.durationMinutes) ?? f.durationMinutes
                        )
                      }
                    />
                  </Row>
                )}
                {(f.goalType === "amount" || f.goalType === "limit") && (
                  <>
                    <Row label={f.goalType === "limit" ? "At most" : "Daily target"} htmlFor="habit-amount">
                      <div className="flex items-center gap-2">
                        <input
                          id="habit-amount"
                          type="number"
                          inputMode="decimal"
                          min={0}
                          value={f.amountTarget}
                          onChange={(e) => set("amountTarget", e.target.value)}
                          className={cn(inlineInput, "w-20")}
                        />
                        <input
                          aria-label="Unit"
                          placeholder="unit"
                          value={f.amountUnit}
                          onChange={(e) => set("amountUnit", e.target.value)}
                          maxLength={12}
                          className={cn(inlineInput, "w-20 text-left")}
                        />
                      </div>
                    </Row>
                    <Divider />
                    <Row label="Each tap adds" htmlFor="habit-step">
                      <input
                        id="habit-step"
                        type="number"
                        inputMode="decimal"
                        min={0}
                        value={f.amountStep}
                        onChange={(e) => set("amountStep", e.target.value)}
                        className={cn(inlineInput, "w-20")}
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
                      value={f.streakGoal}
                      onChange={(e) => set("streakGoal", e.target.value)}
                      className="w-16 bg-transparent text-right text-[17px] text-muted-foreground tabular-nums outline-none placeholder:text-muted-foreground/60 focus:text-foreground"
                    />
                    {f.streakGoal.trim() !== "" && (
                      <span className="text-[15px] text-muted-foreground">
                        {unit === "time" ? "in a row" : `${unit}s`}
                      </span>
                    )}
                  </div>
                </Row>
              </Group>

              <Group label="When" footer={whenFooter(f, draft)}>
                <div className="p-2">
                  <Segmented
                    label="Repeat"
                    value={f.repeat}
                    onChange={(v) => set("repeat", v)}
                    options={[
                      { value: "daily", label: "Daily" },
                      { value: "days", label: "Days" },
                      { value: "week", label: "Weekly" },
                      { value: "month", label: "Monthly" },
                      { value: "interval", label: "Every…" },
                    ]}
                  />
                </div>
                {f.repeat === "days" && (
                  <>
                    <Divider />
                    <ChipRow label="Days of the week">
                      {WEEKDAYS.map((d) => (
                        <Chip
                          key={d.value}
                          label={d.long}
                          on={f.days.includes(d.value)}
                          colorHex={f.colorHex}
                          round
                          onClick={() =>
                            set(
                              "days",
                              f.days.includes(d.value)
                                ? f.days.filter((x) => x !== d.value)
                                : [...f.days, d.value]
                            )
                          }
                        >
                          {d.short}
                        </Chip>
                      ))}
                    </ChipRow>
                  </>
                )}
                {(f.repeat === "week" || f.repeat === "month") && (
                  <>
                    <Divider />
                    <Row label="How often">
                      <Stepper
                        value={`${f.times}× a ${f.repeat}`}
                        decLabel="Fewer times"
                        incLabel="More times"
                        canDec={f.times > 1}
                        canInc={f.times < MAX_TIMES[f.repeat]}
                        onDec={() => set("times", Math.max(1, f.times - 1))}
                        onInc={() => set("times", Math.min(MAX_TIMES[f.repeat as "week"], f.times + 1))}
                      />
                    </Row>
                  </>
                )}
                {f.repeat === "interval" && (
                  <>
                    <Divider />
                    <Row label="Every">
                      <Stepper
                        value={`${f.every} days`}
                        decLabel="More often"
                        incLabel="Less often"
                        canDec={f.every > 2}
                        canInc={f.every < MAX_INTERVAL}
                        onDec={() => set("every", Math.max(2, f.every - 1))}
                        onInc={() => set("every", Math.min(MAX_INTERVAL, f.every + 1))}
                      />
                    </Row>
                  </>
                )}
                <Divider />
                <ChipRow label="Time of day">
                  {DAY_PARTS.map((p) => (
                    <Chip
                      key={p.value}
                      label={p.label}
                      on={f.parts.includes(p.value)}
                      colorHex={f.colorHex}
                      onClick={() => togglePart(p.value)}
                    >
                      {p.label}
                    </Chip>
                  ))}
                </ChipRow>
              </Group>

              <Group>
                <button
                  type="button"
                  aria-expanded={appearanceOpen}
                  onClick={() => setAppearanceOpen((o) => !o)}
                  className="tappable flex min-h-12 w-full items-center justify-between gap-3 px-4 py-1.5 text-left"
                >
                  <span className="text-[17px]">Appearance</span>
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <HabitIcon habitId="preview" icon={f.icon} colorHex={f.colorHex} className="size-8 [&_svg]:size-4" />
                    <ChevronDown
                      className={cn("size-4 transition-transform duration-200", appearanceOpen && "rotate-180")}
                    />
                  </span>
                </button>
                {appearanceOpen && (
                  <>
                    <Divider />
                    <IconGrid icon={f.icon} colorHex={f.colorHex} onPick={(k) => set("icon", k)} />
                    <Divider />
                    <ColorGrid colorHex={f.colorHex} onPick={(c) => set("colorHex", c)} />
                  </>
                )}
              </Group>

              {issue && f.name.trim() && (
                <p className="-mt-3 px-4 text-[13px] text-muted-foreground" role="status">
                  {issue}
                </p>
              )}

              {isEdit && <DeleteHabitButton habit={habit} disabled={pending} />}
            </>
          )}
        </div>
      </form>
    </main>
  );
}

function TemplatePicker({ onPick }: { onPick: (id: string) => void }) {
  return (
    <section className="flex flex-col gap-1.5">
      <h2 className="px-4 font-sans text-[13px] font-medium tracking-wide text-muted-foreground uppercase">
        Or start from a template
      </h2>
      <div className="grid grid-cols-2 gap-2.5">
        {HABIT_TEMPLATES.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onPick(t.id)}
            className="pressable shadow-card flex items-center gap-3 rounded-2xl bg-card p-3 text-left ring-1 ring-black/[0.03] dark:ring-white/[0.06]"
          >
            <HabitIcon habitId={t.id} icon={t.draft.icon} colorHex={t.draft.colorHex} className="size-9 shrink-0" />
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-[15px] font-semibold">{t.draft.name}</span>
              <span className="truncate text-xs text-muted-foreground">{templateHint(t.draft)}</span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

/** "2,000 ml", "Morning & evening", "3× a week", "At most 2 cups". */
function templateHint(d: HabitDraft) {
  const goal = d.goalType === "count" ? null : goalLabel(d);
  const when = d.schedule.type !== "daily" ? scheduleLabel(d.schedule) : d.parts.length ? partsLabel(d.parts) : null;
  return [goal, when].filter(Boolean).join(" · ") || "Every day";
}

function goalFooter(d: HabitDraft) {
  switch (d.goalType) {
    case "time":
      return `Tap play to count down ${formatMinutes(d.durationMinutes)}. Pause any time; the day is done when the timer runs out.`;
    case "amount":
      return `Each tap adds ${withUnit(d.amountStep, d.amountUnit)}. The day is done at ${withUnit(d.amountTarget, d.amountUnit)}.`;
    case "limit":
      return d.amountTarget === 0
        ? "Tap when it happens. A day with nothing logged is a kept day."
        : `Tap when it happens. Days at or under ${withUnit(d.amountTarget, d.amountUnit)} count as kept.`;
    default:
      if (d.parts.length > 1) return `One check for each: ${partsLabel(d.parts).toLowerCase()}.`;
      return d.completionsPerDay === 1
        ? "One tap marks the day done."
        : `Tap ${d.completionsPerDay} times to finish the day.`;
  }
}

function whenFooter(f: FormState, d: HabitDraft) {
  if (f.repeat === "days" && f.days.length === 0) return "Pick at least one day.";
  const s = d.schedule;
  const repeat =
    s.type === "daily"
      ? "Every day."
      : s.type === "days"
        ? `${scheduleLabel(s)}. Other days are rest days.`
        : s.type === "interval"
          ? `Every ${s.every} days, counted from the last time you did it.`
          : `Any ${s.times} ${s.times === 1 ? "day" : "days"} a ${s.period}.`;
  const time =
    d.parts.length === 0
      ? "No time of day: shows under Any time."
      : d.goalType !== "count"
        ? `Shows in your ${partsLabel(d.parts).toLowerCase()} list.`
        : d.parts.length > 1
          ? "A separate check for each time of day."
          : `Shows in your ${partsLabel(d.parts).toLowerCase()} list.`;
  return `${repeat} ${time}`;
}

function ChipRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-1.5 px-4 py-3" role="group" aria-label={label}>
      {children}
    </div>
  );
}

function Chip({
  label,
  on,
  colorHex,
  round,
  onClick,
  children,
}: {
  label: string;
  on: boolean;
  colorHex: string;
  round?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={on}
      onClick={() => {
        haptic();
        onClick();
      }}
      className={cn(
        "pressable flex h-10 items-center justify-center rounded-full text-[15px] font-semibold",
        round ? "size-10" : "flex-1 px-3",
        !on && "bg-foreground/[0.07] text-muted-foreground"
      )}
      style={on ? { backgroundColor: habitTint(colorHex), color: "var(--on-tint)" } : undefined}
    >
      {children}
    </button>
  );
}

function IconGrid({ icon, colorHex, onPick }: { icon: string; colorHex: string; onPick: (key: string) => void }) {
  return (
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
              onPick(key);
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
  );
}

function ColorGrid({ colorHex, onPick }: { colorHex: string; onPick: (hex: string) => void }) {
  return (
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
              onPick(hex);
            }}
            className={cn(
              "pressable flex aspect-square w-full items-center justify-center rounded-squircle text-(--on-tint) outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
              selected && "ring-[2.5px] ring-offset-[3px] ring-offset-card"
            )}
            style={{ backgroundColor: habitTint(hex), "--tw-ring-color": habitTint(hex) } as React.CSSProperties}
          >
            {selected && <Check className="size-4" strokeWidth={3} />}
          </button>
        );
      })}
    </div>
  );
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
              "min-w-0 flex-1 truncate rounded-[7px] px-1 py-1.5 text-[13px] font-medium transition-[background-color,box-shadow] duration-200 ease-(--ease-ios)",
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
