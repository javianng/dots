export type TrackingType = "step" | "custom";

export interface Habit {
  id: string;
  name: string;
  description: string;
  colorHex: string;
  streakGoal: number | null;
  completionsPerDay: number;
  trackingType: TrackingType;
  createdAt: number;
  /** 'YYYY-MM-DD' → completed. Derived from the completions subcollection. */
  history: Record<string, boolean>;
}

export interface HabitDraft {
  name: string;
  description: string;
  colorHex: string;
  streakGoal: number | null;
  completionsPerDay: number;
  trackingType: TrackingType;
}
