"use client";

import { Check, Pause, Play, RotateCcw } from "lucide-react";
import * as React from "react";

import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { useNow } from "@/hooks/use-timer";
import {
  clearDay,
  completeDay,
  elapsedSeconds,
  formatClock,
  formatMinutes,
  isTimerRunning,
  pauseTimer,
  playTimer,
} from "@/lib/check-in";
import { todayKey } from "@/lib/dates";
import { habitTint, habitTintAlpha } from "@/lib/palette";
import { dayTarget } from "@/lib/schedule";
import type { Habit } from "@/lib/types";
import { cn } from "@/lib/utils";

const SIZE = 200;
const STROKE = 10;
const R = (SIZE - STROKE) / 2;
const C = 2 * Math.PI * R;

/**
 * Today's countdown for a time-goal habit: a big ring that drains as time
 * runs, play / pause, reset, and "mark done" for time done away from the app.
 * The timer lives in Firestore, so it keeps running across screens, reloads
 * and devices.
 */
export function TimerCard({ habit }: { habit: Habit }) {
  return (
    <Card>
      <CardContent className="py-2">
        <TimerControls habit={habit} />
      </CardContent>
    </Card>
  );
}

/** The timer card's contents, for embedding in another card. */
export function TimerControls({ habit }: { habit: Habit }) {
  const { user } = useAuth();
  const today = todayKey();
  const running = isTimerRunning(habit, today);
  const now = useNow(running);
  const target = dayTarget(habit);
  const seconds = elapsedSeconds(habit, today, now);
  const left = target - seconds;
  const done = left <= 0;
  const tint = habitTint(habit.colorHex);
  // Another day's timer still running (e.g. started before midnight).
  const otherDayRunning = !!habit.timer && !running;

  return (
    <div className="flex flex-col items-center gap-5">
        <div className="relative flex size-[200px] items-center justify-center">
          <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="absolute inset-0 -rotate-90" aria-hidden>
            <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" strokeWidth={STROKE} className="stroke-foreground/10" />
            <circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={R}
              fill="none"
              strokeWidth={STROKE}
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={C * (1 - seconds / target)}
              className={cn(
                "transition-[stroke-dashoffset] duration-300 ease-linear",
                done && "stroke-accent"
              )}
              style={{ stroke: done ? undefined : tint, opacity: seconds === 0 ? 0 : 1 }}
            />
          </svg>
          <div className="flex flex-col items-center" aria-live="off">
            <span className="text-[44px] leading-none font-bold tracking-tight tabular-nums">
              {done ? <Check className="size-12 text-accent" strokeWidth={3} /> : formatClock(left)}
            </span>
            <span className="mt-1.5 text-[13px] text-muted-foreground">
              {done
                ? `${formatMinutes(habit.durationMinutes)} done today`
                : running
                  ? "remaining"
                  : seconds > 0
                    ? "paused"
                    : `of ${formatMinutes(habit.durationMinutes)}`}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <RoundButton
            label="Reset today's time"
            disabled={!user || (seconds === 0 && !running)}
            onClick={() => user && clearDay(user.uid, habit, today)}
          >
            <RotateCcw className="size-5" />
          </RoundButton>
          <button
            type="button"
            disabled={!user || done || otherDayRunning}
            aria-label={running ? "Pause timer" : "Start timer"}
            onClick={() => {
              if (!user) return;
              if (running) pauseTimer(user.uid, habit);
              else playTimer(user.uid, habit);
            }}
            className="pressable flex size-16 items-center justify-center rounded-full text-(--on-tint) shadow-sm disabled:opacity-35"
            style={{ backgroundColor: tint }}
          >
            {running ? (
              <Pause className="size-7 fill-current" strokeWidth={0} />
            ) : (
              <Play className="ml-1 size-7 fill-current" strokeWidth={0} />
            )}
          </button>
          <RoundButton
            label="Mark today done"
            disabled={!user || done}
            onClick={() => user && completeDay(user.uid, habit, today)}
            style={{ backgroundColor: habitTintAlpha(habit.colorHex, 16), color: tint }}
          >
            <Check className="size-5" strokeWidth={2.5} />
          </RoundButton>
        </div>
        {otherDayRunning && habit.timer && (
          <button
            type="button"
            onClick={() => user && pauseTimer(user.uid, habit)}
            className="tappable text-[13px] text-muted-foreground underline"
          >
            Stop the timer still running for {habit.timer.dateKey}
          </button>
        )}
    </div>
  );
}

function RoundButton({
  label,
  disabled,
  onClick,
  style,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="pressable flex size-12 items-center justify-center rounded-full bg-foreground/[0.07] disabled:opacity-30"
      style={style}
    >
      {children}
    </button>
  );
}
