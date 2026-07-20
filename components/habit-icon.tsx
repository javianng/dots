import {
  BookOpen,
  Coffee,
  Droplets,
  Dumbbell,
  Flower2,
  Heart,
  Leaf,
  Moon,
  Music,
  PenLine,
  Sun,
  Zap,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

const ICONS: LucideIcon[] = [
  Dumbbell, BookOpen, Droplets, Sun, Heart, Leaf,
  Music, PenLine, Coffee, Moon, Zap, Flower2,
];

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/** Tinted icon tile. The icon is picked deterministically from the habit id. */
export function HabitIcon({
  habitId,
  colorHex,
  className,
}: {
  habitId: string;
  colorHex: string;
  className?: string;
}) {
  const Icon = ICONS[hashString(habitId) % ICONS.length];
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
