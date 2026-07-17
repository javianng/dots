"use client";

import * as React from "react";

import { heatmapWeeks, MONTH_LABELS, toDateKey } from "@/lib/dates";
import { cn } from "@/lib/utils";

/**
 * GitHub-style heatmap: 7 rows (Mo–Su) × `weeks` columns, most recent day in
 * the rightmost column. Completed days are filled with the habit tint.
 */
export function Heatmap({
  history,
  colorHex,
  weeks,
  showMonthLabels = false,
  
  className,
}: {
  history: Record<string, boolean>;
  colorHex: string;
  weeks: number;
  showMonthLabels?: boolean;
  className?: string;
}) {
  const columns = React.useMemo(() => heatmapWeeks(weeks), [weeks]);
  const now = new Date();
  const todayKey = toDateKey(now);

  return (
    <div className={cn("flex w-full flex-col gap-1", className)}>
      {showMonthLabels && (
        <div className="flex gap-[3px] text-[10px] text-muted-foreground">
          <span className="w-6 shrink-0" />
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
        <div className="flex w-6 shrink-0 flex-col gap-[3px] text-[10px] text-muted-foreground">
          {WEEKDAY_ROW_LABELS.map((label, row) => (
            <span key={row} className="flex flex-1 items-center">
              {label}
            </span>
          ))}
        </div>
        {columns.map((week, i) => (
          <div key={i} className="flex min-w-0 flex-1 flex-col gap-[3px]">
            {week.map((day) => {
              const key = toDateKey(day);
              const isFuture = key > todayKey;
              const completed = !isFuture && history[key];
              const isCurrentMonth =
                day.getMonth() === now.getMonth() &&
                day.getFullYear() === now.getFullYear();
              return (
                <span
                  key={key}
                  title={key}
                  className={cn(
                    "aspect-square w-full rounded-[3px]",
                    !completed && !isCurrentMonth && "bg-muted",
                    isFuture && "opacity-40"
                  )}
                  style={
                    completed
                      ? { backgroundColor: colorHex }
                      : isCurrentMonth
                        ? { backgroundColor: `${colorHex}29` }
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
