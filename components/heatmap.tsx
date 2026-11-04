"use client";

import * as React from "react";

import { heatmapWeeks, MONTH_LABELS, toDateKey } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { habitTint, habitTintAlpha } from "@/lib/palette";
import { isScheduledDay } from "@/lib/schedule";
import type { Schedule } from "@/lib/types";

// Monday-first rows; labels on Tue/Thu/Sat like GitHub's contribution graph.
const WEEKDAY_ROW_LABELS = ["", "Tue", "", "Thu", "", "Sat", ""];

/** Shared span so the main-page cards and Habit Detail cover the same months. */
export const HEATMAP_WEEKS = 26;

/**
 * GitHub-style heatmap: 7 rows (Mo–Su) × `weeks` columns, most recent day in
 * the rightmost column. Completed days are filled with the habit tint.
 */
export function Heatmap({
  history,
  colorHex,
  weeks,
  schedule,
  showMonthLabels = false,
  showWeekdayLabels = false,
  className,
}: {
  history: Record<string, boolean>;
  colorHex: string;
  weeks: number;
  /** Fixed-weekday schedules fade their rest days. */
  schedule?: Schedule;
  showMonthLabels?: boolean;
  showWeekdayLabels?: boolean;
  className?: string;
}) {
  const columns = React.useMemo(() => heatmapWeeks(weeks), [weeks]);
  const now = new Date();
  const todayKey = toDateKey(now);

  return (
    <div className={cn("flex w-full flex-col gap-1", className)}>
      {showMonthLabels && (
        <div className="flex gap-[3px] text-[10px] text-muted-foreground">
          {showWeekdayLabels && <span className="w-6 shrink-0" />}
          {columns.map((week, i) => {
            const first = week[0];
            const prev = columns[i - 1]?.[0];
            const isNewMonth = !prev || prev.getMonth() !== first.getMonth();
            return (
              <span key={i} className="min-w-0 flex-1 overflow-visible whitespace-nowrap">
                {isNewMonth && i < columns.length - 1
                  ? MONTH_LABELS[first.getMonth()]
                  : " "}
              </span>
            );
          })}
        </div>
      )}
      <div className="flex w-full gap-[3px]">
        {showWeekdayLabels && (
          <div className="flex w-6 shrink-0 flex-col gap-[3px] text-[10px] text-muted-foreground">
            {WEEKDAY_ROW_LABELS.map((label, row) => (
              <span key={row} className="flex flex-1 items-center">
                {label}
              </span>
            ))}
          </div>
        )}
        {columns.map((week, i) => (
          <div key={i} className="flex min-w-0 flex-1 flex-col gap-[3px]">
            {week.map((day) => {
              const key = toDateKey(day);
              const isFuture = key > todayKey;
              const completed = !isFuture && history[key];
              const rest = !completed && !!schedule && !isScheduledDay(schedule, day);
              const isCurrentMonth =
                day.getMonth() === now.getMonth() &&
                day.getFullYear() === now.getFullYear();
              return (
                <span
                  key={key}
                  title={key}
                  className={cn(
                    "aspect-square w-full rounded-squircle",
                    !completed && !isCurrentMonth && "bg-muted",
                    isFuture && "opacity-40",
                    rest && "opacity-35",
                    // Persimmon marks "now": today's dot.
                    key === todayKey && "relative z-10 ring-[1.5px] ring-accent ring-offset-1 ring-offset-card"
                  )}
                  style={
                    completed
                      ? { backgroundColor: habitTint(colorHex) }
                      : isCurrentMonth
                        ? { backgroundColor: habitTintAlpha(colorHex, 16) }
                        : undefined
                  }
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
