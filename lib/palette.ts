/**
 * Habit palette: 12 muted pigments from the javian ng brand (Kinari & Sumi).
 * Each pigment has a light and a dark value, exposed as `--habit-<key>` in
 * app/globals.css. Habits store the light hex, and `habitTint()` turns it into
 * the CSS variable so dark mode can swap in the lighter value. Every pigment
 * keeps the check mark (`--on-tint`) at 4.5:1 or better in both themes.
 */
export const HABIT_COLORS = [
  { key: "ink", name: "Ink", hex: "#22242e" },
  { key: "slate", name: "Slate", hex: "#4f5d70" },
  { key: "indigo", name: "Indigo", hex: "#4a58a8" },
  { key: "violet", name: "Violet", hex: "#7059ae" },
  { key: "plum", name: "Plum", hex: "#97497f" },
  { key: "rose", name: "Rose", hex: "#bc4560" },
  { key: "brick", name: "Brick", hex: "#b8502f" },
  { key: "ochre", name: "Ochre", hex: "#9c6b12" },
  { key: "olive", name: "Olive", hex: "#69752a" },
  { key: "moss", name: "Moss", hex: "#3b7a4b" },
  { key: "teal", name: "Teal", hex: "#2c7873" },
  { key: "sky", name: "Sky", hex: "#2e6f9e" },
] as const;

/** Swatch hexes, rendered as a 6×2 grid in the habit form. */
export const HABIT_PALETTE = HABIT_COLORS.map((c) => c.hex);

/** New habits start in Ink, monochrome like the app icon. */
export const DEFAULT_HABIT_COLOR = HABIT_COLORS[0].hex;

const KEY_BY_HEX = new Map<string, string>(
  HABIT_COLORS.map((c) => [c.hex.toLowerCase(), c.key])
);

/**
 * CSS colour for a habit. Brand pigments resolve to their theme-aware
 * variable; older habits saved with another hex keep that exact colour.
 */
export function habitTint(hex: string): string {
  const key = KEY_BY_HEX.get(hex.toLowerCase());
  return key ? `var(--habit-${key})` : hex;
}

/** The habit colour at a given opacity (0–100), e.g. for tinted backgrounds. */
export function habitTintAlpha(hex: string, percent: number): string {
  return `color-mix(in srgb, ${habitTint(hex)} ${percent}%, transparent)`;
}

export function habitColorName(hex: string): string {
  return (
    HABIT_COLORS.find((c) => c.hex.toLowerCase() === hex.toLowerCase())?.name ?? hex
  );
}
