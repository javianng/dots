"use client";

import { Check, Minus, Plus } from "lucide-react";
import * as React from "react";

import { TimerControls } from "@/components/timer-card";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import {
  clearDay,
  completeDay,
  formatMinutes,
  setAmount,
  toggleSkip,
  toggleSlot,
  usesSlots,
} from "@/lib/check-in";
import { todayKey } from "@/lib/dates";
import { habitTint, habitTintAlpha } from "@/lib/palette";
import { DAY_PARTS, dayTarget, formatAmount, parseKey, withUnit } from "@/lib/schedule";
import type { Habit } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Logs one day of a habit: today by default, or whichever day is picked in
 * the calendar. Shows only the controls the habit's goal needs, plus a quiet
 * "Skip this day" for sick days and travel.
 */
export function DayPanel({
  habit,
  dateKey,
  onBackToToday,
}: {
  habit: Habit;
  dateKey: string;
  onBackToToday: () => void;
}) {
  const { user } = useAuth();
  const today = todayKey();
  const isToday = dateKey === today;
  const skipped = !!habit.skipped[dateKey];
  const title = isToday
    ? "Today"
    : parseKey(dateKey).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });

  if (!user) return null;
  const uid = user.uid;

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[13px] font-semibold tracking-wide text-muted-foreground uppercase">
            {title}
          </h2>
          {!isToday && (
            <button type="button" onClick={onBackToToday} className="tappable text-[13px] font-medium">
              Back to today
            </button>
          )}
        </div>

        {skipped ? (
          <p className="py-4 text-center text-[15px] text-muted-foreground">
            Skipped. This day won&apos;t count or break your streak.
          </p>
        ) : (
          <Controls habit={habit} dateKey={dateKey} uid={uid} />
        )}

        {habit.goalType !== "limit" && (
          <button
            type="button"
            onClick={() => toggleSkip(uid, habit, dateKey)}
            className="tappable self-center text-[13px] text-muted-foreground"
          >
            {skipped ? "Undo skip" : "Skip this day"}
          </button>
        )}
      </CardContent>
    </Card>
  );
}

function Controls({ habit, dateKey, uid }: { habit: Habit; dateKey: string; uid: string }) {
  const target = dayTarget(habit);
  const logged = habit.counts[dateKey] ?? 0;
  const done = !!habit.history[dateKey];
  const tint = habitTint(habit.colorHex);

  if (habit.goalType === "time") {
    if (dateKey === todayKey()) return <TimerControls habit={habit} />;
    const minutes = Math.floor(Math.min(logged, target) / 60);
    return (
      <div className="flex flex-col items-center gap-3">
        <Big value={done ? formatMinutes(habit.durationMinutes) : `${minutes} min`} sub={`of ${formatMinutes(habit.durationMinutes)}`} />
        <BigCheck done={done} tint={tint} onClick={() => (done ? clearDay(uid, habit, dateKey) : completeDay(uid, habit, dateKey))} />
      </div>
    );
  }

  if (usesSlots(habit)) {
    const slots = habit.slots[dateKey] ?? [];
    return (
      <div className="flex gap-2">
        {DAY_PARTS.filter((p) => habit.parts.includes(p.value)).map((p) => {
          const on = slots.includes(p.value);
          return (
            <button
              key={p.value}
              type="button"
              aria-pressed={on}
              onClick={() => toggleSlot(uid, habit, dateKey, p.value)}
              className={cn(
                "pressable flex h-12 flex-1 items-center justify-center gap-1.5 rounded-2xl text-[15px] font-semibold",
                !on && "bg-foreground/[0.07] text-muted-foreground"
              )}
              style={on ? { backgroundColor: tint, color: "var(--on-tint)" } : undefined}
            >
              {on && <Check className="size-4" strokeWidth={3} />}
              {p.label}
            </button>
          );
        })}
      </div>
    );
  }

  if (habit.goalType === "count" && target === 1) {
    return (
      <div className="flex justify-center">
        <BigCheck
          done={done}
          tint={tint}
          onClick={() => (done ? clearDay(uid, habit, dateKey) : completeDay(uid, habit, dateKey))}
        />
      </div>
    );
  }

  // Counted check-ins, amounts and limits: a number with − / + and (for
  // amounts and limits) a field to type an exact value.
  const isLimit = habit.goalType === "limit";
  const step = habit.goalType === "count" ? 1 : habit.amountStep;
  const unit = habit.goalType === "count" ? "" : habit.amountUnit;
  const over = isLimit && logged > target;
  const sub = isLimit
    ? over
      ? `over your limit of ${withUnit(target, unit)}`
      : target === 0
        ? "none is the goal"
        : `at most ${withUnit(target, unit)}`
    : `of ${withUnit(target, unit)}${done ? " · done" : ""}`;

  return (
    <div className="flex flex-col items-center gap-4">
      <Big value={unit ? `${formatAmount(logged)} ${unit}` : formatAmount(logged)} sub={sub} />
      {!isLimit && target > 0 && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-foreground/10">
          <div
            className={cn("h-full rounded-full transition-[width] duration-300 ease-(--ease-ios)", done && "bg-accent")}
            style={{ width: `${Math.min(100, (logged / target) * 100)}%`, backgroundColor: done ? undefined : tint }}
          />
        </div>
      )}
      <div className="flex items-center gap-4">
        <RoundButton label={`Remove ${withUnit(step, unit)}`} disabled={logged <= 0} onClick={() => setAmount(uid, habit, dateKey, logged - step)}>
          <Minus className="size-5" />
        </RoundButton>
        <button
          type="button"
          onClick={() => setAmount(uid, habit, dateKey, logged + step)}
          className="pressable flex h-12 min-w-36 items-center justify-center gap-1.5 rounded-full px-5 text-[15px] font-semibold"
          style={{ backgroundColor: habitTintAlpha(habit.colorHex, 16), color: tint }}
        >
          <Plus className="size-4" strokeWidth={2.5} />
          {withUnit(step, unit)}
        </button>
        {habit.goalType !== "count" ? (
          <ExactAmount key={`${dateKey}-${logged}`} value={logged} unit={unit} onSet={(v) => setAmount(uid, habit, dateKey, v)} />
        ) : (
          <span className="size-12" />
        )}
      </div>
    </div>
  );
}

/** Small "type an exact amount" field, saved on blur / enter. */
function ExactAmount({ value, unit, onSet }: { value: number; unit: string; onSet: (v: number) => void }) {
  const [text, setText] = React.useState("");
  function commit() {
    const v = Number(text);
    if (text.trim() !== "" && Number.isFinite(v) && v >= 0 && v !== value) onSet(v);
    setText("");
  }
  return (
    <input
      type="number"
      inputMode="decimal"
      aria-label={`Set exact amount${unit ? ` in ${unit}` : ""}`}
      placeholder="Set"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          (e.target as HTMLInputElement).blur();
        }
      }}
      className="size-12 rounded-full bg-foreground/[0.07] text-center text-[13px] font-medium tabular-nums outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
    />
  );
}

function Big({ value, sub }: { value: string; sub: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-[34px] leading-none font-bold tracking-tight tabular-nums">{value}</span>
      <span className="mt-1.5 text-[13px] text-muted-foreground">{sub}</span>
    </div>
  );
}

function BigCheck({ done, tint, onClick }: { done: boolean; tint: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={done}
      onClick={onClick}
      className={cn(
        "pressable flex h-12 min-w-44 items-center justify-center gap-2 rounded-full px-6 text-[15px] font-semibold",
        !done && "bg-foreground/[0.07]"
      )}
      style={done ? { backgroundColor: tint, color: "var(--on-tint)" } : undefined}
    >
      <Check className="size-4" strokeWidth={3} />
      {done ? "Done" : "Mark as done"}
    </button>
  );
}

function RoundButton({
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
      onClick={onClick}
      className="pressable flex size-12 items-center justify-center rounded-full bg-foreground/[0.07] disabled:opacity-30"
    >
      {children}
    </button>
  );
}
