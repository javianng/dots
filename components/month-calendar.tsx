"use client";

import * as React from "react";
import { addMonths, differenceInCalendarMonths, startOfMonth } from "date-fns";

import { Calendar } from "@/components/ui/calendar";
import { toDateKey } from "@/lib/dates";
import { habitTint } from "@/lib/palette";

function parseDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Full-month calendar (Mo–Su) built on the shadcn Calendar (react-day-picker).
 * Today gets a ring; completed days get a tinted background. Past/today cells
 * toggle completion on click; future days are disabled.
 */
export function MonthCalendar({
  history,
  colorHex,
  monthOffset,
  onMonthOffsetChange,
  onToggleDay,
}: {
  history: Record<string, boolean>;
  colorHex: string;
  monthOffset: number;
  onMonthOffsetChange: (offset: number) => void;
  onToggleDay: (dateKey: string) => void;
}) {
  const completed = React.useMemo(
    () =>
      Object.keys(history)
        .filter((key) => history[key])
        .map(parseDateKey),
    [history]
  );

  return (
    <Calendar
      month={addMonths(startOfMonth(new Date()), monthOffset)}
      onMonthChange={(month) =>
        onMonthOffsetChange(
          differenceInCalendarMonths(startOfMonth(month), startOfMonth(new Date()))
        )
      }
      weekStartsOn={1}
      disabled={{ after: new Date() }}
      modifiers={{ completed }}
      modifiersClassNames={{
        // Tint the cell itself: the ghost day button is transparent, so the
        // tint shows through and its hover overlay still reads as feedback.
        completed:
          "bg-(--habit-tint) [&_button]:font-semibold [&_button]:text-(--on-tint) [&_button]:hover:text-(--on-tint)",
      }}
      onDayClick={(day, modifiers) => {
        if (!modifiers.disabled) onToggleDay(toDateKey(day));
      }}
      className="w-full p-0 [--cell-radius:9999px] [--cell-size:--spacing(10)] [&_button[data-day]]:text-[15px] [&_button[data-day]]:transition-[background-color,transform] [&_button[data-day]]:duration-200 [&_button[data-day]:active]:scale-90"
      classNames={{
        root: "w-full",
        today: "rounded-(--cell-radius) [&_button]:font-bold [&_button]:ring-2 [&_button]:ring-accent",
      }}
      style={{ "--habit-tint": habitTint(colorHex) } as React.CSSProperties}
    />
  );
}
