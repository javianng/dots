import { HABIT_ICONS, resolveHabitIconKey } from "@/lib/habit-icons";
import { cn } from "@/lib/utils";

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
        "flex size-10 shrink-0 items-center justify-center rounded-lg",
        className
      )}
      style={{ backgroundColor: `${colorHex}29`, color: colorHex }}
    >
      <Icon className="size-5" />
    </span>
  );
}
