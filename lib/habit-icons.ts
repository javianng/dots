import {
  Apple,
  Bed,
  Bike,
  BookOpen,
  Brain,
  Camera,
  Code,
  Coffee,
  Dog,
  Droplets,
  Dumbbell,
  Flame,
  Flower2,
  Footprints,
  GraduationCap,
  Heart,
  Leaf,
  Moon,
  Music,
  Palette,
  PenLine,
  Smile,
  Sprout,
  Star,
  Sun,
  Sunrise,
  Target,
  Utensils,
  Wallet,
  Zap,
  type LucideIcon,
} from "lucide-react";

/** Curated set of habit icons, keyed by a stable string stored on the habit. */
export const HABIT_ICONS: Record<string, LucideIcon> = {
  dumbbell: Dumbbell,
  footprints: Footprints,
  bike: Bike,
  book: BookOpen,
  pen: PenLine,
  code: Code,
  brain: Brain,
  graduation: GraduationCap,
  palette: Palette,
  music: Music,
  camera: Camera,
  heart: Heart,
  droplets: Droplets,
  apple: Apple,
  utensils: Utensils,
  coffee: Coffee,
  moon: Moon,
  bed: Bed,
  sun: Sun,
  sunrise: Sunrise,
  leaf: Leaf,
  flower: Flower2,
  sprout: Sprout,
  target: Target,
  flame: Flame,
  zap: Zap,
  star: Star,
  smile: Smile,
  wallet: Wallet,
  dog: Dog,
};

export const HABIT_ICON_KEYS = Object.keys(HABIT_ICONS);

/** Default icon key for new habits. */
export const DEFAULT_HABIT_ICON = HABIT_ICON_KEYS[0];

export function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/**
 * Resolve a habit's icon key. Uses the stored `icon` when it maps to a curated
 * icon; otherwise falls back to a deterministic pick from `habitId` so legacy
 * habits (no stored icon) still get a stable icon.
 */
export function resolveHabitIconKey(
  icon: string | undefined,
  habitId: string
): string {
  if (icon && HABIT_ICONS[icon]) return icon;
  return HABIT_ICON_KEYS[hashString(habitId) % HABIT_ICON_KEYS.length];
}
