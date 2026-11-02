import { HABIT_ICONS, resolveHabitIconKey } from "@/lib/habit-icons";
import { cn } from "@/lib/utils";
import { habitTint, habitTintAlpha } from "@/lib/palette";

/** Tinted icon tile. Uses the habit's chosen icon, falling back to the id. */
export function HabitIcon({
  habitId,
  icon,
  colorHex,
  className,
}: {
  habitId: string;
  icon?: string;
  colorHex: string;
  className?: string;
}) {
  const Icon = HABIT_ICONS[resolveHabitIconKey(icon, habitId)];
  return (
    <span
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-squircle",
        className
      )}
      style={{ backgroundColor: habitTintAlpha(colorHex, 16), color: habitTint(colorHex) }}
    >
      <Icon className="size-5" />
    </span>
  );
}
